from fastapi import Header, HTTPException

from app.core.utils import fail, public


def expected_version(if_match: str | None = Header(default=None)):
    if if_match is None:
        fail(428, "VERSION_REQUIRED", "Send the current content_version in If-Match.")
    value = if_match.strip('"')
    if not value.isdigit() or int(value) < 1:
        fail(422, "INVALID_VERSION", "If-Match must contain a positive content_version.")
    return int(value)


def check_version(poi, version):
    if version is not None and poi["content_version"] != version:
        raise HTTPException(409, {"code": "VERSION_CONFLICT", "message": "POI changed. Reload and compare before saving.", "current": public(poi)})
