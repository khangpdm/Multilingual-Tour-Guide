import io
import os
from urllib.parse import quote, urlsplit

import qrcode
from PIL import Image, ImageDraw, ImageFont
from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import Field

from app.core.security import require
from app.core.config import settings
from app.core.state import mutation_lock
from app.core.utils import fail, get_record, now, update_record
from app.modules.media.storage import IMAGE_LIMIT, asset_path, checked_image, store_bytes
from app.modules.pois.routes import editable_poi, poi_public
from app.modules.pois.versioning import expected_version
from app.db.connection import database
from app.schemas.base import Input

router = APIRouter()


class ImageOrder(Input):
    images: list[str] = Field(max_length=10)
    cover_image: str | None = None


@router.get("/admin/assets/{filename}")
def asset(filename: str, user=Depends(require("poi.view"))):
    return FileResponse(asset_path("/admin/assets/" + filename, missing_status=404), headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"})


@router.post("/admin/pois/{poi_id}/images")
async def upload_image(poi_id: str, file: UploadFile = File(...), version=Depends(expected_version), user=Depends(require("poi.edit"))):
    try:
        data = checked_image(await file.read(IMAGE_LIMIT + 1))
    finally:
        await file.close()
    with mutation_lock, database.transaction():
        poi = editable_poi(poi_id, version)
        if len(poi.get("images", [])) >= 10:
            fail(422, "IMAGE_LIMIT", "At most 10 images per POI.")
        url, _ = store_bytes(data, "jpg")
        return poi_public(update_record("pois", poi_id, {"images": [*poi.get("images", []), url], "cover_image": poi.get("cover_image") or url, "last_modified_by": user["user_id"]}, user, "poi.image_add"))


@router.put("/admin/pois/{poi_id}/images")
def order_images(poi_id: str, body: ImageOrder, version=Depends(expected_version), user=Depends(require("poi.edit"))):
    with mutation_lock, database.transaction():
        poi = editable_poi(poi_id, version)
        if len(set(body.images)) != len(body.images) or sorted(body.images) != sorted(poi.get("images", [])):
            fail(422, "INVALID_ORDER", "Reorder existing images only.")
        if body.images and body.cover_image not in body.images or not body.images and body.cover_image:
            fail(422, "INVALID_COVER", "Choose a cover from the existing images.")
        return poi_public(update_record("pois", poi_id, {**body.model_dump(), "last_modified_by": user["user_id"]}, user, "poi.images_order"))


@router.delete("/admin/pois/{poi_id}/images/{filename}")
def delete_image(poi_id: str, filename: str, version=Depends(expected_version), user=Depends(require("poi.edit"))):
    with mutation_lock, database.transaction():
        poi = editable_poi(poi_id, version)
        images = [image for image in poi.get("images", []) if image.rsplit("/", 1)[-1] != filename]
        if len(images) == len(poi.get("images", [])):
            fail(404, "NOT_FOUND", "Image does not belong to this POI.")
        cover = poi.get("cover_image") if poi.get("cover_image") in images else next(iter(images), None)
        return poi_public(update_record("pois", poi_id, {"images": images, "cover_image": cover, "last_modified_by": user["user_id"]}, user, "poi.image_remove"))




def qr_details(poi_id: str, request: Request):
    poi = get_record("pois", poi_id)
    if poi.get("is_archived"):
        fail(410, "QR_INACTIVE", "This POI is archived.")
    if not poi.get("qr_code"):
        fail(404, "QR_MISSING", "Assign a QR code first.")
    local_request = (
        settings.get("APP_ENV", "production").lower() == "development"
        and request.client is not None
        and request.client.host in {"127.0.0.1", "::1"}
        and request.url.hostname in {"localhost", "127.0.0.1", "::1"}
    )
    base = (settings.get("PUBLIC_APP_URL") or "").rstrip("/")
    preview = False
    if not base and local_request:
        base = (settings.get("ADMIN_PUBLIC_URL") or "http://localhost:3000").rstrip("/")
        preview = True
    try:
        parsed = urlsplit(base)
        if parsed.port == 0:
            raise ValueError("Invalid public application port.")
    except ValueError:
        fail(503, "QR_BASE_URL_NOT_CONFIGURED", "Configure PUBLIC_APP_URL as the public HTTPS application URL.")
    loopback = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    local_http = local_request and loopback and parsed.scheme == "http"
    if (parsed.scheme != "https" and not local_http) or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or any(character.isspace() for character in base) or "\\" in base or (preview and not loopback):
        fail(503, "QR_BASE_URL_NOT_CONFIGURED", "Configure PUBLIC_APP_URL as the public HTTPS application URL.")
    if loopback and not local_request:
        fail(503, "QR_BASE_URL_NOT_CONFIGURED", "A loopback QR URL is only allowed for local development.")
    name = poi.get("content", {}).get("en", poi.get("content", {}).get("vi", {})).get("name", poi_id)
    return {"qr_code": poi["qr_code"], "target_url": base + "/q/" + quote(poi["qr_code"], safe=""), "poi_name": name, "is_local_preview": preview or loopback}

@router.get("/admin/pois/{poi_id}/qr/info")
def qr_info(poi_id: str, request: Request, user=Depends(require("poi.view"))):
    return qr_details(poi_id, request)

@router.get("/admin/pois/{poi_id}/qr/image")
def qr_image(poi_id: str, request: Request, user=Depends(require("poi.view"))):
    details = qr_details(poi_id, request)
    buffer = io.BytesIO()
    image = qrcode.make(details["target_url"]).convert("RGB")
    name = details["poi_name"]
    font_path = settings.get("QR_FONT_PATH") or (os.path.join(os.environ.get("WINDIR", "C:/Windows"), "Fonts", "arial.ttf") if os.name == "nt" else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    font = ImageFont.truetype(font_path, 18) if os.path.isfile(font_path) else ImageFont.load_default(size=18)
    lines, current = [], ""
    draw = ImageDraw.Draw(image)
    for character in name:
        if current and draw.textlength(current + character, font=font) > image.width - 20:
            lines.append(current)
            current = ""
        current += character
    if current:
        lines.append(current)
    if details["is_local_preview"]:
        lines.append("QR THU NGHIEM LOCAL")
    output = Image.new("RGB", (image.width, image.height + 28 * len(lines) + 16), "white")
    output.paste(image, (0, 0))
    draw = ImageDraw.Draw(output)
    for index, line in enumerate(lines):
        draw.text((image.width / 2, image.height + 8 + 28 * index), line, fill="black", font=font, anchor="mt")
    output.save(buffer, format="PNG")
    return Response(buffer.getvalue(), media_type="image/png", headers={"Cache-Control": "no-store", "Content-Disposition": f'inline; filename="qr-{poi_id}.png"'})
