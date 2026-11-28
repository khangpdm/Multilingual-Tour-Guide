import { toast } from 'sonner'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { activeTask, dateLabel, emptyContent, enqueue, poiName, stamp, uid, useAdmin } from '../../admin/store'
import type { Content, Data, OfflineRelease, Permission, Poi, Zone } from '../../admin/types'
import { api, assetUrl, listAll } from '../../admin/api'
import { GeofenceConfig } from './GeofenceConfig'
import { ZoneBoundaryMap } from './ZoneBoundaryMap'
import { CrudDialog, Empty, Field, Heading, Notice, Status, usePagination } from '../../shared/ui'

type ZonePack = OfflineRelease & { latest_built_at: string | null }
const packStatuses = {
  building: 'Đang đóng gói', ready: 'Chờ phát hành', published: 'Đã cập nhật',
  superseded: 'Đã thay thế / thu hồi', failed: 'Thất bại',
}

export function Zones() {
  const { data, can, mode } = useAdmin()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [packs, setPacks] = useState<ZonePack[] | null>(null)
  const [packError, setPackError] = useState('')
  const showPacks = mode === 'live' && can('offline.view')

  useEffect(() => {
    if (!showPacks) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const result = await listAll<ZonePack>('/admin/offline-packs?latest_per_zone=true')
        if (cancelled) return
        setPacks(result)
        setPackError('')
        if (result.some(pack => pack.status === 'building' ||
          (pack.status === 'ready' && !pack.error && pack.latest_built_at &&
            Date.now() - Date.parse(pack.latest_built_at) < 60_000))) {
          timer = setTimeout(load, 5000)
        }
      } catch (error) {
        if (!cancelled) setPackError((error as Error).message)
      }
    }
    void load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [showPacks, data.zones])

  const packsByZone = new Map(packs?.map(pack => [pack.zone_id, pack]))
  const visibleZones = data.zones.filter(zone => zone.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))

  return <>
    <Heading title="Khu vực" detail="Quản lý khu vực tham quan và các gói tải ngoại tuyến.">
      {can('system.manage_constants') && <button className="primary-button" onClick={() => navigate('/zones/new')}>+ Tạo khu vực</button>}
    </Heading>
    {can('system.manage_constants') && <details className="zone-settings">
      <summary>Cấu hình bán kính kích hoạt chung</summary>
      <GeofenceConfig />
    </details>}
    <div className="zone-toolbar">
      <span>{visibleZones.length} khu vực</span>
      <input className="select-control" aria-label="Tìm khu vực" placeholder="Tìm theo tên khu vực…" value={query} onChange={event => setQuery(event.target.value)} />
    </div>
    {showPacks && packError && <Notice>Không tải được thông tin gói offline. {packError}</Notice>}
    <div className="zone-grid zone-list">{visibleZones.map(zone => {
      const pack = packsByZone.get(zone.zone_id)
      const totalSize = pack?.common_size_bytes == null || pack.languages.some(part => part.size_bytes == null)
        ? null : pack.languages.reduce((sum, part) => sum + (part.size_bytes ?? 0), pack.common_size_bytes)
      return <section key={zone.zone_id} className="panel">
        <div className="zone-card-title"><h2>{zone.name}</h2><Status value={zone.is_active ? 'active' : 'inactive'} /></div>
        <p className="zone-poi-count">{zone.poi_count ?? data.pois.filter(poi => poi.zone_id === zone.zone_id && poi.status === 'active').length} POI công khai</p>
        {showPacks && (pack ? <dl className="zone-pack-summary">
          <div><dt>Gói offline</dt><dd>v{pack.version} · {pack.outdated ? 'Đã lỗi thời' : packStatuses[pack.status]}</dd></div>
          <div><dt>Dung lượng</dt><dd>{totalSize == null ? '—' : `${(totalSize / 1024 / 1024).toFixed(2)} MB`}</dd></div>
          <div><dt>Đóng gói gần nhất</dt><dd>{dateLabel(pack.latest_built_at)}</dd></div>
        </dl> : <p className="zone-pack-empty">{packs ? 'Chưa có gói offline' : packError ? 'Thông tin gói chưa khả dụng' : 'Đang tải thông tin gói offline…'}</p>)}
        <div className="zone-card-footer"><small>Zoom {zone.map_region.min_zoom}–{zone.map_region.max_zoom}</small><button type="button" className="secondary-button" aria-haspopup="dialog" onClick={() => navigate(`/zones/${zone.zone_id}/edit`)}>Chi tiết</button></div>
      </section>
    })}</div>
    {!visibleZones.length && <Empty text={query.trim() ? 'Không tìm thấy khu vực phù hợp.' : 'Chưa có khu vực.'} />}
  </>
}
export function ZoneEditor({ id }: { id: string }) {
  const { data, can, mutate, busy, mode } = useAdmin()
  const navigate = useNavigate()
  const original = data.zones.find(zone => zone.zone_id === id)
  const [draft, setDraft] = useState<Zone>(original ? structuredClone(original) : { zone_id: uid('zone'), name: '', map_region: { bbox: [106.68, 10.76, 106.72, 10.80], min_zoom: 11, max_zoom: 16 }, is_active: true })
  const [uploading, setUploading] = useState(false)
  const [boundaryText, setBoundaryText] = useState(original?.boundary ? JSON.stringify(original.boundary, null, 2) : '')

  let boundary: [number, number][] = []
  try {
    const parsed = JSON.parse(boundaryText || '[]')
    if (Array.isArray(parsed) && parsed.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) boundary = parsed
  } catch { /* A partial JSON draft is validated on save. */ }

  async function uploadCover(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const result = await api<{ cover_image: string }>('/admin/zones/cover', { method: 'POST', body })
      setDraft(current => ({ ...current, cover_image: result.cover_image }))
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  function useBoundary(points: [number, number][]) {
    const longitudes = points.map(([longitude]) => longitude)
    const latitudes = points.map(([, latitude]) => latitude)
    const bbox = [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)]
    setBoundaryText(JSON.stringify(points))
    setDraft(current => ({ ...current, map_region: { ...current.map_region, bbox } }))
  }

  if (id !== 'new' && !original) return <Empty text="Không tìm thấy khu vực." />
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      const [minLng, minLat, maxLng, maxLat] = draft.map_region.bbox
      if (!draft.name.trim() || draft.name.length > 100 || data.zones.some(zone => zone.zone_id !== draft.zone_id && zone.name.toLowerCase() === draft.name.trim().toLowerCase())) throw new Error('Tên khu vực cần duy nhất, 1–100 ký tự.')
      if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite) || minLng >= maxLng || minLat >= maxLat || maxLng - minLng > 1 || maxLat - minLat > 1 || minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) throw new Error('Bounding box hợp lệ, min < max; mỗi chiều tối đa 1°.')
      if (draft.map_region.min_zoom > draft.map_region.max_zoom) throw new Error('Zoom nhỏ nhất không vượt zoom lớn nhất.')
      const names = Object.fromEntries(Object.entries(draft.names ?? {}).map(([locale, name]) => [locale, name.trim()]).filter(([, name]) => name))
      const body = { name: draft.name.trim(), names, description: draft.description?.trim() || null, cover_image: draft.cover_image || null, map_region: draft.map_region, is_active: draft.is_active, boundary: boundaryText.trim() ? JSON.parse(boundaryText) : null }
      await mutate({ permission: 'system.manage_constants', path: original ? `/admin/zones/${id}` : '/admin/zones', method: original ? 'PUT' : 'POST', body, action: original ? 'zone.update' : 'zone.create', target: draft.zone_id, before: original, after: body, demo: current => ({ ...current, zones: original ? current.zones.map(zone => zone.zone_id === id ? { ...draft, ...body } : zone) : [...current.zones, { ...draft, ...body }] }) }); toast.success('Đã lưu khu vực.'); navigate('/zones')
    } catch (error) { toast.error((error as Error).message) }
  }
  return <form className="panel admin-form" onSubmit={save}>
    {original?.is_active && mode === 'live' && can('offline.manage') && <div className="admin-actions">
      <button type="button" className="secondary-button" disabled={busy || uploading} onClick={() => navigate(`/offline-packs?zone=${encodeURIComponent(original.zone_id)}`)}>Tạo gói offline</button>
    </div>}
    <fieldset disabled={!can('system.manage_constants') || busy || uploading}><Field label="Tên khu vực"><input required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field>
    <div className="form-grid">{data.languages.filter(language => language.is_active).map(language => <Field key={language.code} label={`Tên khu vực · ${language.native_name}`}>
      <input maxLength={100} value={draft.names?.[language.code] ?? ''} onChange={event => setDraft({ ...draft, names: { ...draft.names, [language.code]: event.target.value } })} />
    </Field>)}</div>
    <Field label="Mô tả khu vực"><textarea rows={3} maxLength={2000} value={draft.description ?? ''} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field>
    <Field label="Ảnh bìa khu vực"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.target.files?.[0]
      if (file) void uploadCover(file)
    }} /></Field>
    {uploading && <p role="status">Đang tải ảnh bìa…</p>}
    {draft.cover_image && <div className="admin-actions"><img src={assetUrl(draft.cover_image)} width={150} alt="Ảnh bìa khu vực" /><button type="button" className="secondary-button" onClick={() => setDraft({ ...draft, cover_image: null })}>Gỡ ảnh bìa</button></div>}
    {original && <details><summary>Điểm tham quan và audio trong khu vực</summary>
      {data.pois.filter(poi => poi.zone_id === id).map(poi => <p key={poi.poi_id}>
        {poiName(poi)} · {poi.status === 'active' ? 'Hoạt động' : 'Đã lưu trữ'} · {data.languages.filter(language => language.is_active).map(language => {
          const state = poi.content_status?.[language.code]
          return `${language.code.toUpperCase()}: ${state === 'ready' || poi.content[language.code]?.audio_url ? 'Có audio' : state === 'pending' ? 'Đang tạo' : state === 'failed' ? 'Lỗi' : 'Thiếu audio'}`
        }).join(' · ')}
      </p>)}
    </details>}
    <ZoneBoundaryMap bbox={draft.map_region.bbox} boundary={boundary} disabled={!can('system.manage_constants') || busy || uploading} onChange={useBoundary} />
    <details><summary>Tọa độ và mức zoom nâng cao</summary><div className="form-grid">{['Kinh độ nhỏ nhất', 'Vĩ độ nhỏ nhất', 'Kinh độ lớn nhất', 'Vĩ độ lớn nhất'].map((label, index) => <Field key={label} label={label}><input required type="number" step="any" min={index % 2 ? -90 : -180} max={index % 2 ? 90 : 180} value={draft.map_region.bbox[index]} onChange={event => setDraft({ ...draft, map_region: { ...draft.map_region, bbox: draft.map_region.bbox.map((value, position) => position === index ? event.target.valueAsNumber : value) } })} /></Field>)}{(['min_zoom', 'max_zoom'] as const).map(key => <Field key={key} label={key === 'min_zoom' ? 'Zoom nhỏ nhất' : 'Zoom lớn nhất'}><input required type="number" min={0} max={22} step={1} value={draft.map_region[key]} onChange={event => setDraft({ ...draft, map_region: { ...draft.map_region, [key]: event.target.valueAsNumber } })} /></Field>)}</div><Field label="Polygon ranh giới (JSON, cặp kinh độ/vĩ độ; điểm cuối trùng điểm đầu)"><textarea rows={5} value={boundaryText} onChange={event => setBoundaryText(event.target.value)} placeholder="[[106.68,10.76],[106.72,10.76],[106.72,10.80],[106.68,10.76]]" /></Field></details><label className="admin-check"><input type="checkbox" checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} />Khu vực đang bật</label><Notice>Muốn tắt khu vực, hãy chuyển hoặc lưu trữ toàn bộ điểm tham quan đang hoạt động trong khu vực.</Notice>{can('system.manage_constants') && <button className="primary-button">Lưu khu vực</button>}</fieldset></form>
}
