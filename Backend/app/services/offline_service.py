from datetime import datetime, timezone
from fastapi import HTTPException
from app.core.config import (
    IMAGE_DIR,
    AUDIO_DIR,
    LANG_SHARD_MAX_LANGS,
    ZONE_CACHE_TTL,
)

_IMAGE_METADATA_CACHE = {}
_POI_JSON_CACHE = {}
_ZONE_LIST_CACHE = {
    'expire_at': 0,
    'data': None,
}

from api.routes.pois import (
    public_poi,
    get_active_languages,
    to_iso,
)
from urllib.parse import urlsplit, unquote, urlencode

def utc_now():
    return datetime.now(timezone.utc)

def normalize_datetime(value):
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)

def datetime_cache_key(value):
    normalized = normalize_datetime(value)
    if normalized is None:
        return ""
    return normalized.isoformat(timespec="microseconds")

def parse_requested_languages(langs:str):
    requested = {
        item.strip()
        for item in langs.split(",")
        if item.strip()
    }

    if not requested:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_LANGUAGES",
                "message": "Phải cung cấp ít nhất một ngôn ngữ.",
            }
        )
    if len(requested) > LANG_SHARD_MAX_LANGS:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "TOO_MANY_LANGUAGES",
                "message": f"Chỉ được chọn tối đa {LANG_SHARD_MAX_LANGS} ngôn ngữ.",
            },
        )

    return sorted(requested)

async def validate_language(db,requested_languages):
    active_languages = await get_active_languages(db)
    invalid_languages = set(requested_languages) - active_languages

    if invalid_languages:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "LANGUAGE_NOT_AVAILABLE",
                "message": "Có ngôn ngữ chưa được kích hoạt.",
                "invalid_languages": sorted(invalid_languages),
            },
        )
    return active_languages

async def get_active_zone(db, zone_id: str):
    zone = await db["zones"].find_one({
        "_id": zone_id,
        "is_active": True,
    })

    if zone is None:
        zone = await db["zones"].find_one({
            "zone_id": zone_id,
            "is_active": True,
        })

    if zone is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ZONE_NOT_FOUND",
                "message": "Không tìm thấy Zone hoặc Zone đã bị vô hiệu hóa.",
            },
        )

    return zone

def get_zone_id(zone):
    return str(zone.get("zone_id", zone.get("_id")))

def resolve_safe_path(file_url: str) -> Path:
    if not isinstance(file_url, str) or not file_url.strip():
        raise HTTPException(status_code=500, detail="Đường dẫn file không hợp lệ.")

    parsed = urlsplit(file_url)
    relative_path = unquote(parsed.path).lstrip("/")

    if relative_path.startswith("images/"):
        root = IMAGE_DIR
        relative_path = relative_path[len("images/"):]
    elif relative_path.startswith("audio/"):
        root = AUDIO_DIR
        relative_path = relative_path[len("audio/"):]
    else:
        raise HTTPException(
            status_code=500,
            detail=f"URL file không thuộc thư mục static hợp lệ: {file_url}",
        )
    root = root.resolve()
    file_path = (root / relative_path).resolve()

    try:
        file_path.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Đường dẫn file không hợp lệ.")

    if not file_path.is_file():
        raise HTTPException(
            status_code=500,
            detail=f"Không tìm thấy file trên server: {file_url}",
        )

    return file_path