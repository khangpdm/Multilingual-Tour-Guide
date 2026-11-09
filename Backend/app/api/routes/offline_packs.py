from fastapi import APIRouter, Query, Request, Response

from core.config import LANG_SHARD_MAX_LANGS, ZONE_CACHE_TTL

router = APIRouter(prefix="/offline-packs", tags=["Offline Packs"])


class OfflinePackAPIError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


def _api_error(status_code: int, code: str, message: str) -> OfflinePackAPIError:
    return OfflinePackAPIError(status_code, code, message)


@router.get("/zones")
async def list_downloadable_zones(request: Request, response: Response):
    """Return active zones that have a published offline-pack release."""
    pool = request.app.state.db_pool
    try:
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT
                        z.id,
                        z.name,
                        r.id,
                        r.version,
                        (
                            SELECT COUNT(*)
                            FROM poi p
                            WHERE p.zone_id = z.id AND p.status = 'active'
                        ) AS poi_count,
                        (
                            SELECT GROUP_CONCAT(l.language_code ORDER BY l.language_code SEPARATOR ',')
                            FROM offline_pack_languages l
                            WHERE l.release_id = r.id AND l.status = 'ready'
                        ) AS available_languages,
                        r.common_size_bytes + COALESCE(vi.size_bytes, 0) AS estimated_size_bytes,
                        z.min_lng,
                        z.min_lat,
                        z.max_lng,
                        z.max_lat,
                        z.min_zoom,
                        z.max_zoom
                    FROM zone z
                    JOIN offline_pack_releases r
                      ON r.zone_id = z.id AND r.status = 'published'
                    LEFT JOIN offline_pack_languages vi
                      ON vi.release_id = r.id
                     AND vi.language_code = 'vi'
                     AND vi.status = 'ready'
                    WHERE z.is_active = 1
                    ORDER BY z.name ASC
                    """
                )
                rows = await cursor.fetchall()

        response.headers["Cache-Control"] = f"public, max-age={ZONE_CACHE_TTL}"
        return {
            "zones": [
                {
                    "zone_id": row[0],
                    "name": row[1],
                    "release_id": row[2],
                    "version": row[3],
                    "poi_count": int(row[4]),
                    "available_languages": (row[5] or "").split(",") if row[5] else [],
                    "estimated_size_bytes": int(row[6] or 0),
                    "map_region": {
                        "bbox": [float(row[7]), float(row[8]), float(row[9]), float(row[10])],
                        "min_zoom": row[11],
                        "max_zoom": row[12],
                    },
                }
                for row in rows
            ]
        }
    except OfflinePackAPIError:
        raise
    except Exception as exc:
        raise _api_error(503, "DATABASE_UNAVAILABLE", "Không thể tải danh sách Offline Pack") from exc


@router.get("/{zone_id}/manifest")
async def get_zone_manifest(
    zone_id: str,
    request: Request,
    langs: str = Query(default="vi"),
):
    """Return the published common pack and requested ready language shards."""
    language_codes = [code.strip() for code in langs.split(",") if code.strip()]
    if not language_codes or len(language_codes) > LANG_SHARD_MAX_LANGS or len(set(language_codes)) != len(language_codes):
        raise _api_error(
            422,
            "VALIDATION_ERROR",
            f"langs phải gồm 1..{LANG_SHARD_MAX_LANGS} locale không trùng nhau",
        )

    pool = request.app.state.db_pool
    try:
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                placeholders = ", ".join(["%s"] * len(language_codes))
                await cursor.execute(
                    f"""
                    SELECT code
                    FROM languages
                    WHERE is_active = 1 AND code IN ({placeholders})
                    """,
                    tuple(language_codes),
                )
                active_languages = {row[0] for row in await cursor.fetchall()}

                if active_languages != set(language_codes):
                    raise _api_error(422, "INVALID_LANGUAGE", "Locale không tồn tại hoặc đã bị tắt")

                await cursor.execute(
                    """
                    SELECT r.id, r.version, r.common_file_url, r.common_sha256,
                           r.common_size_bytes
                    FROM zone z
                    JOIN offline_pack_releases r
                      ON r.zone_id = z.id AND r.status = 'published'
                    WHERE z.id = %s AND z.is_active = 1
                    LIMIT 1
                    """,
                    (zone_id,),
                )
                release = await cursor.fetchone()
                if release is None:
                    raise _api_error(404, "PACK_NOT_PUBLISHED", "Zone không có Offline Pack đã publish")

                await cursor.execute(
                    f"""
                    SELECT language_code, file_url, sha256, size_bytes
                    FROM offline_pack_languages
                    WHERE release_id = %s AND status = 'ready'
                      AND language_code IN ({placeholders})
                    ORDER BY FIELD(language_code, {placeholders})
                    """,
                    (release[0], *language_codes, *language_codes),
                )
                shards = await cursor.fetchall()

        ready_codes = {row[0] for row in shards}
        if ready_codes != set(language_codes):
            raise _api_error(409, "LANGUAGE_SHARD_NOT_READY", "Language Shard chưa sẵn sàng")

        return {
            "zone_id": zone_id,
            "release_id": release[0],
            "version": release[1],
            "common_pack": {
                "url": release[2],
                "sha256": release[3],
                "size_bytes": int(release[4]),
            },
            "language_shards": [
                {
                    "language_code": row[0],
                    "url": row[1],
                    "sha256": row[2],
                    "size_bytes": int(row[3]),
                }
                for row in shards
            ],
        }
    except OfflinePackAPIError:
        raise
    except Exception as exc:
        raise _api_error(503, "DATABASE_UNAVAILABLE", "Không thể tải manifest Offline Pack") from exc
