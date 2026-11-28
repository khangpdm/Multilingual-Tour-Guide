import json
import subprocess
import struct
from pathlib import Path
from urllib.parse import urlsplit

from app.core.config import ROOT, settings
from app.core.utils import fail


def map_source():
    path = settings.get("OFFLINE_PMTILES_SOURCE", "").strip()
    if not path:
        return None
    source = Path(path).expanduser()
    if not source.is_absolute():
        source = ROOT / source
    try:
        if not source.is_file():
            raise OSError
        stat = source.stat()
    except OSError:
        fail(503, "OFFLINE_MAP_SOURCE_MISSING", "Không tìm thấy nguồn PMTiles trên máy chủ.")
    return source, f"{source.name}:{stat.st_size}:{stat.st_mtime_ns}"


def extract_map(zone, source, destination):
    west, south, east, north = zone["map_region"]["bbox"]
    with source.open("rb") as handle:
        header = handle.read(127)
    if len(header) != 127 or header[:8] != b"PMTiles\x03":
        fail(422, "OFFLINE_MAP_INVALID", "Nguồn bản đồ phải là PMTiles phiên bản 3.")
    bounds = [coordinate / 10_000_000 for coordinate in struct.unpack_from("<iiii", header, 102)]
    if west < bounds[0] or south < bounds[1] or east > bounds[2] or north > bounds[3]:
        fail(422, "OFFLINE_MAP_OUTSIDE_SOURCE", "Khu vực nằm ngoài phạm vi nguồn PMTiles. Hãy bổ sung nguồn bản đồ bao phủ khu vực này.")
    min_zoom = max(zone["map_region"]["min_zoom"], header[100])
    max_zoom = min(zone["map_region"]["max_zoom"], header[101])
    if min_zoom > max_zoom:
        fail(422, "OFFLINE_MAP_ZOOM_UNAVAILABLE", "Nguồn PMTiles không có dữ liệu ở mức zoom đã chọn.")
    ring = zone.get("boundary") or [[west, south], [east, south], [east, north], [west, north], [west, south]]
    region = destination.with_suffix(".geojson")
    region.write_text(json.dumps({
        "type": "Feature", "properties": {},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }), encoding="utf-8")
    executable = settings.get("OFFLINE_PMTILES_CLI", "pmtiles")
    if not Path(executable).is_absolute() and len(Path(executable).parts) > 1:
        executable = str(ROOT / executable)
    try:
        subprocess.run([
            executable, "extract", str(source), str(destination),
            f"--region={region}", f"--minzoom={min_zoom}",
            f"--maxzoom={max_zoom}",
        ], check=True, capture_output=True, timeout=600)
        with destination.open("rb") as handle:
            if handle.read(8) != b"PMTiles\x03":
                raise ValueError
    except (OSError, subprocess.SubprocessError, ValueError):
        fail(503, "OFFLINE_MAP_EXTRACT_FAILED", "Không thể cắt PMTiles. Hãy kiểm tra nguồn bản đồ và chương trình pmtiles.")


def upload_release(files):
    bucket = settings.get("OFFLINE_S3_BUCKET", "").strip()
    base = settings.get("OFFLINE_CDN_BASE_URL", "").strip().rstrip("/")
    if not bucket and not base:
        return None
    try:
        parsed = urlsplit(base)
        if not bucket or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError
        import boto3
        from botocore.config import Config
        client = boto3.client("s3", config=Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 2}))
        for path in files:
            client.upload_file(str(path), bucket, f"offline-packs/{path.name}", ExtraArgs={
                "ContentType": "application/zip", "CacheControl": "public, max-age=86400",
            })
    except Exception:
        fail(503, "OFFLINE_UPLOAD_FAILED", "Chưa phát hành gói. Hãy kiểm tra cấu hình S3/CDN và quyền tải tệp lên.")
    return f"{base}/offline-packs"
