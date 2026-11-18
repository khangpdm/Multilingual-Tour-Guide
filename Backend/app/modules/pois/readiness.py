from app.db.connection import database
from app.modules.zones.geometry import contains

CATEGORIES = {
    "heritage": "Di tích", "museum": "Bảo tàng", "religion": "Tôn giáo",
    "architecture": "Kiến trúc", "park": "Công viên", "food": "Ẩm thực",
}


def readiness(poi, locales=None):
    issues = []
    zone = database.fetch_one("zones", {"_id": poi.get("zone_id")})
    if not zone or not zone.get("is_active"):
        issues.append({"field": "zone_id", "message": "Choose an active zone."})
    location = poi.get("location", {})
    point = location.get("coordinates") if location.get("type") == "Point" else [location.get("lng"), location.get("lat")]
    if zone and (not point or None in point or not contains(zone, *point)):
        issues.append({"field": "location", "message": "POI must be inside its zone."})
    if poi.get("category") not in CATEGORIES:
        issues.append({"field": "category", "message": "Choose a valid category."})
    if poi.get("is_archived") or poi.get("status") == "archived":
        issues.append({"field": "status", "message": "POI is archived."})
    images = poi.get("images", [])
    if not images:
        issues.append({"field": "images", "message": "Add at least one image."})
    if not poi.get("cover_image") or poi.get("cover_image") not in images:
        issues.append({"field": "cover_image", "message": "Select a cover image."})
    for locale in dict.fromkeys(["en", *(locales or [])]):
        content = poi.get("content", {}).get(locale, {})
        for field in ("name", "text", "audio_url", "audio_sha256"):
            if not str(content.get(field) or "").strip():
                issues.append({"field": f"content.{locale}.{field}", "message": f"{locale}: missing {field}."})
    return {"ready": not issues, "issues": issues}
