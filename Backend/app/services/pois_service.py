from datetime import datetime, timezone
from typing import Optional, Dict, Any

def to_iso(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat(
            timespec="seconds"
        ).replace("+00:00","Z")
    return value

def public_poi(document: dict, active_languages: set[str],
               requested_languages: Optional[set[str]] = None) -> dict:
    """
    Format dữ liệu POI từ MySQL row/dict sang chuẩn PoiPublic (mục 2.4 của spec)
    """
    poi_id = document.get("poi_id")
    location = document.get("location", {"lat": 0.0, "lng": 0.0})
    
    content = {}
    for lang, value in document.get("content", {}).items():
        if lang not in active_languages:
            continue
        if requested_languages and lang not in requested_languages:
            continue

        content[lang] = {
            "name": value.get("name", ""),
            "address": value.get("address"),
            "text": value.get("text", ""),
            "audio_url": value.get("audio_url"),
            "audio_sha256": value.get("audio_sha256"),
            "updated_at": to_iso(value.get("updated_at")),
        }
        
    return {
        "poi_id": poi_id,
        "zone_id": document.get("zone_id"),
        "category": document.get("category"),
        "location": location,
        "geofence_radius_m": document.get("geofence_radius_m", 30),
        "qr_code": document.get("qr_code"),
        "images": document.get("images", []),
        "content": content,
        "updated_at": to_iso(document.get("updated_at")),
    }

async def get_active_languages(pool) -> set[str]:
    """Lấy danh sách các mã ngôn ngữ đang active từ MySQL"""
    async with pool.acquire() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT code FROM languages WHERE is_active = 1")
            rows = await cursor.fetchall()
            return {row[0] for row in rows}

async def find_active_poi(pool, field: str, value: str) -> Optional[Dict[str, Any]]:
    """
    Tìm một POI active theo field (ví dụ: 'id' hoặc 'qr_code') 
    kèm theo toàn bộ nội dung (content) từ bảng poi_content.
    """
    if field not in {"id", "qr_code"}:
        raise ValueError("Invalid field for POI lookup")

    async with pool.acquire() as conn:
        async with conn.cursor() as cursor:
            sql_poi = f"""
                SELECT 
                    id, zone_id, category, status, radius, qr_code, images, updated_at,
                    ST_X(location) as lng, ST_Y(location) as lat
                FROM poi 
                WHERE {field} = %s AND status = 'active'
            """
            await cursor.execute(sql_poi, (value,))
            poi_row = await cursor.fetchone()
            
            if not poi_row:
                return None
            
            poi_id = poi_row[0]
            poi_data = {
                "poi_id": poi_id,
                "zone_id": poi_row[1],
                "category": poi_row[2],
                "status": poi_row[3],
                "geofence_radius_m": poi_row[4],
                "qr_code": poi_row[5],
                "images": poi_row[6] if isinstance(poi_row[6], list) else [], # Hoặc xử lý JSON decode nếu cần
                "updated_at": poi_row[7],
                "location": {
                    "lng": poi_row[8],
                    "lat": poi_row[9]
                }
            }

            sql_content = """
                SELECT 
                    language_code, name, address, description, text, 
                    audio_url, audio_sha256, updated_at
                FROM poi_content
                WHERE poi_id = %s
            """
            await cursor.execute(sql_content, (poi_id,))
            content_rows = await cursor.fetchall()
            
            content_dict = {}
            for crow in content_rows:
                lang_code = crow[0]
                content_dict[lang_code] = {
                    "name": crow[1],
                    "address": crow[2],
                    "description": crow[3],
                    "text": crow[4],
                    "audio_url": crow[5],
                    "audio_sha256": crow[6],
                    "updated_at": crow[7]
                }
            
            poi_data["content"] = content_dict
            return poi_data