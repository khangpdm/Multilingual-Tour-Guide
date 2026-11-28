from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends

from app.core.security import require
from app.core.utils import fail, now
from app.db.connection import database

router = APIRouter()
LOCAL_TZ = timezone(timedelta(hours=7))
METRICS = """
    COUNT(CASE WHEN e.event_type='AUDIO_PLAY' THEN 1 END) AS audio_plays,
    COUNT(CASE WHEN e.event_type='QR_SCAN' THEN 1 END) AS qr_scans,
    COUNT(CASE WHEN e.event_type='PACK_DOWNLOAD' THEN 1 END) AS pack_downloads,
    COUNT(DISTINCT e.device_id) AS unique_devices,
    SUM(CASE WHEN e.event_type='AUDIO_PLAY' THEN e.duration_ms END) AS total_duration_ms,
    AVG(CASE WHEN e.event_type='AUDIO_PLAY' THEN e.duration_ms END) AS average_duration_ms
"""


def utc_midnight(day):
    return datetime.combine(day, time.min, LOCAL_TZ).astimezone(timezone.utc).replace(tzinfo=None)


@router.get("/admin/analytics/dashboard")
def dashboard_analytics(
    start: date | None = None,
    end: date | None = None,
    zone_id: str | None = None,
    poi_id: str | None = None,
    lang: str | None = None,
    trigger: Literal["geofence", "qr_scan", "manual_tap"] | None = None,
    user=Depends(require("poi.view")),
):
    current_time = now()
    today = current_time.astimezone(LOCAL_TZ).date()
    end = end or today
    start = start or end - timedelta(days=6)
    if not today - timedelta(days=89) <= start <= end <= today:
        fail(422, "INVALID_ANALYTICS_RANGE", "Chọn khoảng ngày hợp lệ trong 90 ngày gần nhất.")
    days = (end - start).days + 1
    begin, finish = utc_midnight(start), utc_midnight(end + timedelta(days=1))
    clauses = ["e.occurred_at >= %s", "e.occurred_at < %s"]
    filters = []
    if zone_id:
        clauses.append("COALESCE(e.zone_id, (SELECT p.zone_id FROM poi p WHERE p.id=e.poi_id)) = %s")
        filters.append(zone_id)
    for column, value in (("poi_id", poi_id), ("language_code", lang)):
        if value:
            clauses.append(f"e.{column} = %s")
            filters.append(value)
    if trigger:
        clauses.append("(e.trigger_source = %s OR (%s = 'qr_scan' AND e.event_type = 'QR_SCAN'))")
        filters.extend([trigger, trigger])
    where = " WHERE " + " AND ".join(clauses)
    parameters = [begin, finish, *filters]
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT " + METRICS + " FROM analytics_events e" + where, parameters)
        totals = cursor.fetchone()
        cursor.execute("SELECT " + METRICS + " FROM analytics_events e" + where,
                       [begin - timedelta(days=days), begin, *filters])
        previous = cursor.fetchone()
        cursor.execute("SELECT DATE(e.occurred_at + INTERVAL 7 HOUR) AS day," + METRICS
                       + " FROM analytics_events e" + where + " GROUP BY day ORDER BY day", parameters)
        events_by_day = {row["day"]: row for row in cursor.fetchall()}
        cursor.execute("SELECT e.poi_id," + METRICS + " FROM analytics_events e" + where
                       + " AND e.poi_id IS NOT NULL GROUP BY e.poi_id ORDER BY audio_plays DESC, e.poi_id",
                       parameters)
        poi_rows = cursor.fetchall()
        cursor.execute("SELECT e.poi_id,e.language_code,COUNT(*) AS audio_plays FROM analytics_events e"
                       + where + " AND e.event_type='AUDIO_PLAY' AND e.poi_id IS NOT NULL "
                       "GROUP BY e.poi_id,e.language_code ORDER BY audio_plays DESC", parameters)
        languages = {}
        for row in cursor.fetchall():
            languages.setdefault(row["poi_id"], []).append(row)
    pois = {poi["poi_id"]: poi for poi in database.fetch_all("pois")}
    points = []
    for row in poi_rows:
        poi = pois.get(row["poi_id"])
        if poi is None:
            continue
        longitude, latitude = poi["location"]["coordinates"]
        content = poi.get("content", {})
        name = next((content[code]["name"] for code in (lang, "vi", "en") if content.get(code, {}).get("name")), poi["poi_id"])
        points.append({**row, "name": name, "lng": longitude, "lat": latitude,
                       "languages": languages.get(row["poi_id"], [])})
    series = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        series.append(events_by_day.get(day, {"day": day, "audio_plays": 0, "qr_scans": 0, "pack_downloads": 0}))
    return {"totals": totals, "previous": previous, "series": series, "top": points[:10],
            "points": [point for point in points if point["audio_plays"]], "updated_at": current_time}
