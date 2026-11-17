import hashlib
import html
import json
import math
import mimetypes
import re
import zipfile
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Header, Query, Response
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from pydantic import BaseModel, Field

from app.core.utils import fail, public
from app.db.connection import database
from app.modules.media.storage import asset_path
from app.modules.offline.routes import query, verify_bundle

router = APIRouter(tags=['Mobile'])

class PresenceHeartbeat(BaseModel):
    installation_id: UUID

@router.post('/mobile/heartbeat')
def heartbeat(body: PresenceHeartbeat):
    with database.connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            'INSERT INTO mobile_presence (installation_id,last_seen_at) VALUES (%s,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE last_seen_at=UTC_TIMESTAMP(3)',
            (str(body.installation_id),),
        )
    return {'status': 'ok'}


def active_pois():
    zones = {zone['zone_id'] for zone in database.fetch_all('zones', {'is_active': True})}
    return [poi for poi in database.fetch_all('pois') if poi.get('status') == 'active' and not poi.get('is_archived') and poi.get('zone_id') in zones]


def find_poi(value, field='poi_id'):
    record = next((poi for poi in active_pois() if poi.get(field) == value), None)
    if not record:
        fail(404, 'POI_NOT_FOUND', 'Không tìm thấy địa điểm đang hoạt động.')
    return record


def active_languages():
    return {item['code'] for item in database.fetch_all('languages', {'is_active': True})}


def media_url(url):
    return url.replace('/admin/assets/', '/media/', 1) if url and url.startswith('/admin/assets/') else None


def public_poi(record, locales=None):
    languages = active_languages()
    requested = languages if locales is None else languages.intersection({'en', *locales})
    localized = {}
    default = record.get('content', {}).get('en', {})
    for locale in sorted(requested):
        source = record.get('content', {}).get(locale, {})
        audio = source if source.get('audio_url') else default
        localized[locale] = {key: source.get(key) or default.get(key) for key in ('name', 'address', 'description', 'introduction', 'text', 'updated_at')}
        localized[locale].update(audio_url=media_url(audio.get('audio_url')), audio_sha256=audio.get('audio_sha256'), audio_fallback_locale='en' if audio is default and locale != 'en' else None)
    location = record['location']
    if location.get('type') == 'Point':
        longitude, latitude = location['coordinates']
        location = {'lat': latitude, 'lng': longitude}
    return public({
        'poi_id': record['poi_id'], 'zone_id': record['zone_id'], 'category': record['category'],
        'location': location, 'geofence_radius_m': record.get('geofence_radius_m', 30),
        'priority': record.get('priority', 0), 'content_version': record.get('content_version', 1),
        'qr_code': record.get('qr_code'), 'images': [media_url(image) for image in record.get('images', []) if media_url(image)],
        'cover_image': media_url(record.get('cover_image')), 'content': localized, 'updated_at': record.get('updated_at'),
    })


@router.get('/languages')
def languages():
    records = sorted(database.fetch_all('languages', {'is_active': True}), key=lambda item: item['display_order'])
    return {'languages': [{key: record[key] for key in ('code', 'name', 'native_name', 'is_default', 'display_order')} for record in records]}


@router.get('/poi/load-all')
def load_all(response: Response, langs: str | None = None, updated_after: datetime | None = None, if_none_match: str | None = Header(default=None)):
    synced_at = datetime.now(timezone.utc)
    records = active_pois()
    items = sorted([public_poi(record, langs.split(',') if langs is not None else None) for record in records], key=lambda item: item['poi_id'])
    deleted = []
    if updated_after:
        cutoff = updated_after.replace(tzinfo=timezone.utc) if updated_after.tzinfo is None else updated_after.astimezone(timezone.utc)
        items = [item for item in items if datetime.fromisoformat(item['updated_at'].replace('Z', '+00:00')) > cutoff]
        visible = {record['poi_id'] for record in records}
        deleted = [record['poi_id'] for record in database.fetch_all('pois') if record['poi_id'] not in visible]
    payload = {'updated_pois': items, 'deleted_poi_ids': sorted(deleted)}
    etag = '"' + hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest() + '"'
    headers = {'ETag': etag, 'Cache-Control': 'no-cache'}
    if if_none_match == etag:
        return Response(status_code=304, headers=headers)
    response.headers.update(headers)
    return {**payload, 'sync_timestamp': synced_at.isoformat()}


def poi_result(record, lang, trigger='manual_tap'):
    if lang not in active_languages():
        fail(422, 'INACTIVE_LANGUAGE', 'Ngôn ngữ chưa được bật.')
    item = public_poi(record)
    content = item['content'].get(lang, {})
    return {'poi': item, 'poi_id': item['poi_id'], 'name': content.get('name'), 'audio_url': content.get('audio_url'), 'audio_tier_available': ['tier1_pregen'] if content.get('audio_url') else [], 'trigger_source': trigger}


@router.get('/poi/by-qr/{token}')
def by_qr(token: str, lang: str = 'vi'):
    return poi_result(find_poi(token, 'qr_code'), lang, 'qr_scan')


@router.get('/poi/hotset')
def hotset(lat: float = Query(ge=-90, le=90), lng: float = Query(ge=-180, le=180), radius_km: float = Query(1.5, ge=0.1, le=5), limit: int = Query(10, ge=1, le=20), lang: str = 'vi'):
    if lang not in active_languages():
        fail(422, 'INACTIVE_LANGUAGE', 'Ngôn ngữ chưa được bật.')
    items = []
    for record in active_pois():
        poi = public_poi(record)
        point = poi['location']
        latitude_delta = math.radians(point['lat'] - lat)
        longitude_delta = math.radians(point['lng'] - lng)
        distance = 12742000 * math.asin(min(1, math.sqrt(math.sin(latitude_delta / 2) ** 2 + math.cos(math.radians(lat)) * math.cos(math.radians(point['lat'])) * math.sin(longitude_delta / 2) ** 2)))
        if distance <= radius_km * 1000:
            content = poi['content'].get(lang, {})
            items.append({'poi_id': poi['poi_id'], 'distance_m': round(distance, 2), 'audio_ready': bool(content.get('audio_url')), 'audio_url': content.get('audio_url'), 'audio_sha256': content.get('audio_sha256')})
    return {'hotset_pois': sorted(items, key=lambda item: item['distance_m'])[:limit]}


@router.get('/poi/{poi_id}')
def detail(poi_id: str, lang: str = 'vi'):
    return poi_result(find_poi(poi_id), lang)


@router.get('/media/{name}')
def media(name: str):
    path = asset_path('/admin/assets/' + name)
    target = '/admin/assets/' + name
    locales = active_languages()
    visible = any(target in record.get('images', []) or any(locale in locales and content.get('audio_url') == target for locale, content in record.get('content', {}).items()) for record in active_pois())
    if not visible:
        fail(404, 'NOT_FOUND', 'Tài nguyên không thuộc địa điểm đang hoạt động.')
    return FileResponse(path, headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})


class AudioRequest(BaseModel):
    poi_id: str = Field(min_length=1, max_length=100)
    target_locale: str = Field(min_length=2, max_length=20)


@router.post('/audio/synthesize')
def available_audio(body: AudioRequest):
    result = poi_result(find_poi(body.poi_id), body.target_locale)
    content = result['poi']['content'].get(body.target_locale, {})
    if not content.get('audio_url'):
        fail(404, 'AUDIO_NOT_READY', 'Audio chưa sẵn sàng. Quản trị viên cần tạo hoặc tải MP3 lên.')
    return {'status': 'ready', 'audio_url': content['audio_url'], 'audio_sha256': content.get('audio_sha256'), 'audio_fallback_locale': content.get('audio_fallback_locale')}


@router.get('/audio/{poi_id}/{locale}.mp3')
def audio_file(poi_id: str, locale: str):
    result = available_audio(AudioRequest(poi_id=poi_id, target_locale=locale))
    return RedirectResponse(result['audio_url'], status_code=307)


@router.get('/audio/tasks/{task_id}')
def audio_task(task_id: str):
    record = query('SELECT id,poi_id,state,progress FROM audio_tasks WHERE id=%s', (task_id,), one=True)
    if not record:
        fail(404, 'NOT_FOUND', 'Không tìm thấy tác vụ.')
    find_poi(record['poi_id'])
    return {'task_id': record['id'], 'state': record['state'], 'progress': record['progress']}


@router.get('/offline-packs')
def offline_catalog():
    zones = {zone['zone_id']: zone for zone in database.fetch_all('zones', {'is_active': True})}
    locales = active_languages()
    items = []
    for record in query("SELECT * FROM offline_pack_releases WHERE status='published' ORDER BY published_at DESC"):
        if record['zone_id'] not in zones:
            continue
        release_id = record['id']
        parts = query("SELECT language_code,sha256,size_bytes FROM offline_pack_languages WHERE release_id=%s AND status='ready'", (release_id,))
        items.append(public({
            'id': release_id, 'zone_id': record['zone_id'], 'zone_name': zones[record['zone_id']]['name'],
            'version': record['version'], 'poi_count': record['poi_count'], 'published_at': record['published_at'],
            'common': {'file_url': f'/offline-packs/{release_id}/files/common', 'sha256': record['common_sha256'], 'size_bytes': record['common_size_bytes']},
            'languages': [{**part, 'file_url': f'/offline-packs/{release_id}/files/{part["language_code"]}'} for part in parts if part['language_code'] in locales],
        }))
    return {'items': items}


def published_part(release_id: str, part: str):
    release = query("SELECT * FROM offline_pack_releases WHERE id=%s AND status='published'", (release_id,), one=True)
    if not release or not database.fetch_one('zones', {'_id': release['zone_id'], 'is_active': True}):
        fail(404, 'NOT_FOUND', 'Không tìm thấy gói đang phát hành.')
    if part == 'common':
        checksum = release['common_sha256']
    else:
        language = query("SELECT sha256 FROM offline_pack_languages WHERE release_id=%s AND language_code=%s AND status='ready'", (release_id, part), one=True)
        if not language or part not in active_languages():
            fail(404, 'NOT_FOUND', 'Không tìm thấy gói ngôn ngữ.')
        checksum = language['sha256']
    return verify_bundle(release_id, part, checksum)


@router.get('/offline-packs/{release_id}/files/{part}')
def offline_download(release_id: str, part: str):
    path = published_part(release_id, part)
    return FileResponse(path, media_type='application/zip', filename=path.name, headers={'Cache-Control': 'no-cache'})


@router.get('/offline-packs/{release_id}/manifest/{part}')
def offline_manifest(release_id: str, part: str):
    path = published_part(release_id, part)
    with zipfile.ZipFile(path) as archive:
        manifest = json.loads(archive.read('manifest.json'))
    resources = []
    for relative, checksum in manifest.get('asset_sha256', {}).items():
        if not re.fullmatch(r'assets/[a-f0-9]{32}\.(jpg|png|webp|mp3)', relative):
            fail(409, 'PACK_INVALID', 'Gói chứa đường dẫn tài nguyên không hợp lệ.')
        resources.append({'path': relative, 'sha256': checksum, 'url': f'/offline-packs/{release_id}/assets/{part}/{relative.split("/")[-1]}'})
    return {**manifest, 'resources': resources}


@router.get('/offline-packs/{release_id}/assets/{part}/{name}')
def offline_asset(release_id: str, part: str, name: str):
    if not re.fullmatch(r'[a-f0-9]{32}\.(jpg|png|webp|mp3)', name):
        fail(404, 'NOT_FOUND', 'Tài nguyên không hợp lệ.')
    path = published_part(release_id, part)
    with zipfile.ZipFile(path) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        relative = 'assets/' + name
        expected = manifest.get('asset_sha256', {}).get(relative)
        if not expected or relative not in archive.namelist():
            fail(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên trong gói.')
        content = archive.read(relative)
    if hashlib.sha256(content).hexdigest() != expected:
        fail(409, 'PACK_INVALID', 'Tài nguyên trong gói không khớp mã kiểm tra.')
    return Response(content, media_type=mimetypes.guess_type(name)[0] or 'application/octet-stream', headers={'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'})


@router.get('/q/{token}', response_class=HTMLResponse)
def qr_page(token: str, lang: str = 'vi'):
    result = poi_result(find_poi(token, 'qr_code'), lang, 'qr_scan')
    poi = result['poi']
    content = poi['content'].get(lang, poi['content'].get('en', {}))
    name = html.escape(content.get('name') or 'Tour Guide')
    text = html.escape(content.get('text') or '')
    audio = '<audio controls preload="none" src="' + html.escape(result['audio_url'], quote=True) + '"></audio>' if result['audio_url'] else '<p>Audio chưa sẵn sàng.</p>'
    return HTMLResponse(f'<!doctype html><html lang="{html.escape(lang, quote=True)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{name}</title></head><body><main style="max-width:680px;margin:32px auto;padding:16px;font-family:sans-serif"><h1>{name}</h1>{audio}<p style="white-space:pre-wrap">{text}</p></main></body></html>', headers={'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'", 'Referrer-Policy': 'no-referrer'})
