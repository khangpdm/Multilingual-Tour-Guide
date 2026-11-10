import io

import qrcode
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import Field

from app.core.security import require
from app.core.state import mutation_lock
from app.core.utils import fail, get_record, now, update_record
from app.modules.media.storage import AUDIO_LIMIT, IMAGE_LIMIT, asset_path, checked_image, checked_mp3, store_bytes
from app.modules.pois.routes import editable_poi, poi_public
from app.schemas.base import Input

router = APIRouter()


class ImageOrder(Input):
    images: list[str] = Field(max_length=10)
    cover_image: str | None = None


@router.get("/admin/assets/{filename}")
def asset(filename: str, user=Depends(require("poi.view"))):
    return FileResponse(asset_path("/admin/assets/" + filename), headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"})


@router.post("/admin/pois/{poi_id}/images")
async def upload_image(poi_id: str, file: UploadFile = File(...), user=Depends(require("poi.edit"))):
    try:
        data = checked_image(await file.read(IMAGE_LIMIT + 1))
    finally:
        await file.close()
    with mutation_lock:
        poi = editable_poi(poi_id)
        if len(poi.get("images", [])) >= 10:
            fail(422, "IMAGE_LIMIT", "At most 10 images per POI.")
        url, _ = store_bytes(data, "jpg")
        return poi_public(update_record("pois", poi_id, {"images": [*poi.get("images", []), url], "cover_image": poi.get("cover_image") or url, "last_modified_by": user["user_id"]}, user, "poi.image_add"))


@router.put("/admin/pois/{poi_id}/images")
def order_images(poi_id: str, body: ImageOrder, user=Depends(require("poi.edit"))):
    with mutation_lock:
        poi = editable_poi(poi_id)
        if len(set(body.images)) != len(body.images) or sorted(body.images) != sorted(poi.get("images", [])):
            fail(422, "INVALID_ORDER", "Reorder existing images only.")
        if body.images and body.cover_image not in body.images or not body.images and body.cover_image:
            fail(422, "INVALID_COVER", "Choose a cover from the existing images.")
        return poi_public(update_record("pois", poi_id, {**body.model_dump(), "last_modified_by": user["user_id"]}, user, "poi.images_order"))


@router.delete("/admin/pois/{poi_id}/images/{filename}")
def delete_image(poi_id: str, filename: str, user=Depends(require("poi.edit"))):
    with mutation_lock:
        poi = editable_poi(poi_id)
        images = [image for image in poi.get("images", []) if image.rsplit("/", 1)[-1] != filename]
        if len(images) == len(poi.get("images", [])):
            fail(404, "NOT_FOUND", "Image does not belong to this POI.")
        cover = poi.get("cover_image") if poi.get("cover_image") in images else next(iter(images), None)
        return poi_public(update_record("pois", poi_id, {"images": images, "cover_image": cover, "last_modified_by": user["user_id"]}, user, "poi.image_remove"))


@router.post("/admin/pois/{poi_id}/content/{locale}/audio")
async def upload_audio(poi_id: str, locale: str, file: UploadFile = File(...), user=Depends(require("poi.edit"))):
    try:
        data = checked_mp3(await file.read(AUDIO_LIMIT + 1))
    finally:
        await file.close()
    with mutation_lock:
        poi = editable_poi(poi_id)
        if locale not in poi.get("content", {}) or not get_record("languages", locale).get("is_active"):
            fail(422, "INVALID_LANGUAGE", "Save content for an active language first.")
        url, checksum = store_bytes(data, "mp3")
        content = {**poi["content"][locale], "audio_url": url, "audio_sha256": checksum, "audio_source": "UPLOADED", "updated_at": now()}
        return poi_public(update_record("pois", poi_id, {"content." + locale: content, "last_modified_by": user["user_id"]}, user, "poi.audio_upload"))


@router.get("/admin/pois/{poi_id}/qr/image")
def qr_image(poi_id: str, user=Depends(require("poi.view"))):
    poi = get_record("pois", poi_id)
    if not poi.get("qr_code"):
        fail(404, "QR_MISSING", "Assign a QR code first.")
    buffer = io.BytesIO()
    qrcode.make(poi["qr_code"]).save(buffer, format="PNG")
    return Response(buffer.getvalue(), media_type="image/png", headers={"Cache-Control": "no-store", "Content-Disposition": f'inline; filename="qr-{poi_id}.png"'})
