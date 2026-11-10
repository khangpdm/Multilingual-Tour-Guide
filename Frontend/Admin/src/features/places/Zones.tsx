import { toast } from 'sonner'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { activeTask, dateLabel, emptyContent, enqueue, poiName, stamp, uid, useAdmin } from '../../admin/store'
import type { Content, Data, Permission, Poi, Zone } from '../../admin/types'
import { assetUrl } from '../../admin/api'
import { CrudDialog, Empty, Field, Heading, Notice, Status, usePagination } from '../../shared/ui'

export function Zones() {
  const { data, can } = useAdmin()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  return <><Heading title="Khu vực" detail="Khu vực tải offline, bounding box và mức zoom bản đồ.">{can('system.manage_constants') && <button className="primary-button" onClick={() => navigate('/zones/new')}>+ Tạo khu vực</button>}</Heading><input className="select-control" aria-label="Tìm khu vực" placeholder="Tìm khu vực…" value={query} onChange={event => setQuery(event.target.value)} /><div className="zone-grid">{data.zones.filter(zone => zone.name.toLowerCase().includes(query.toLowerCase())).map(zone => <section key={zone.zone_id} className="panel"><div className="card-header"><h2>{zone.name}</h2><Status value={zone.is_active ? 'active' : 'inactive'} /></div><p>{zone.poi_count ?? data.pois.filter(poi => poi.zone_id === zone.zone_id && poi.status === 'published').length} POI công khai · Zoom {zone.map_region.min_zoom}–{zone.map_region.max_zoom}</p><small>Bbox: {zone.map_region.bbox.join(', ')}</small><div><button className="text-button" onClick={() => navigate(`/zones/${zone.zone_id}/edit`)}>Chi tiết →</button></div></section>)}</div><Notice>Tắt khu vực chỉ ẩn gói offline, không tắt POI. Manifest được backend sinh động; không cần build/publish gói thủ công.</Notice></>
}
export function ZoneEditor({ id }: { id: string }) {
  const { data, can, mutate, busy } = useAdmin()
  const navigate = useNavigate()
  const original = data.zones.find(zone => zone.zone_id === id)
  const [draft, setDraft] = useState<Zone>(original ? structuredClone(original) : { zone_id: uid('zone'), name: '', map_region: { bbox: [106.68, 10.76, 106.72, 10.80], min_zoom: 11, max_zoom: 16 }, is_active: true })

  if (id !== 'new' && !original) return <Empty text="Không tìm thấy khu vực." />
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      const [minLng, minLat, maxLng, maxLat] = draft.map_region.bbox
      if (!draft.name.trim() || draft.name.length > 100 || data.zones.some(zone => zone.zone_id !== draft.zone_id && zone.name.toLowerCase() === draft.name.trim().toLowerCase())) throw new Error('Tên khu vực cần duy nhất, 1–100 ký tự.')
      if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite) || minLng >= maxLng || minLat >= maxLat || maxLng - minLng > 1 || maxLat - minLat > 1 || minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) throw new Error('Bounding box hợp lệ, min < max; mỗi chiều tối đa 1°.')
      if (draft.map_region.min_zoom > draft.map_region.max_zoom) throw new Error('Zoom nhỏ nhất không vượt zoom lớn nhất.')
      const body = { name: draft.name.trim(), map_region: draft.map_region, is_active: draft.is_active }
      await mutate({ permission: 'system.manage_constants', path: original ? `/admin/zones/${id}` : '/admin/zones', method: original ? 'PUT' : 'POST', body, action: original ? 'zone.update' : 'zone.create', target: draft.zone_id, before: original, after: body, demo: current => ({ ...current, zones: original ? current.zones.map(zone => zone.zone_id === id ? { ...draft, ...body } : zone) : [...current.zones, { ...draft, ...body }] }) }); toast.success('Đã lưu khu vực.'); navigate('/zones')
    } catch (error) { toast.error((error as Error).message) }
  }
  return <><Heading title={original ? original.name : 'Tạo khu vực'} detail="Tọa độ WGS84, thứ tự bbox: kinh độ min, vĩ độ min, kinh độ max, vĩ độ max."><button className="secondary-button" onClick={() => navigate('/zones')}>Về danh sách</button></Heading><form className="panel admin-form" onSubmit={save}><fieldset disabled={!can('system.manage_constants') || busy}><Field label="Tên khu vực"><input required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><div className="form-grid">{['Kinh độ nhỏ nhất', 'Vĩ độ nhỏ nhất', 'Kinh độ lớn nhất', 'Vĩ độ lớn nhất'].map((label, index) => <Field key={label} label={label}><input required type="number" step="any" min={index % 2 ? -90 : -180} max={index % 2 ? 90 : 180} value={draft.map_region.bbox[index]} onChange={event => setDraft({ ...draft, map_region: { ...draft.map_region, bbox: draft.map_region.bbox.map((value, position) => position === index ? event.target.valueAsNumber : value) } })} /></Field>)}{(['min_zoom', 'max_zoom'] as const).map(key => <Field key={key} label={key === 'min_zoom' ? 'Zoom nhỏ nhất' : 'Zoom lớn nhất'}><input required type="number" min={0} max={22} step={1} value={draft.map_region[key]} onChange={event => setDraft({ ...draft, map_region: { ...draft.map_region, [key]: event.target.valueAsNumber } })} /></Field>)}</div><label className="admin-check"><input type="checkbox" checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} />Khu vực đang bật</label><Notice>Không yêu cầu tắt các POI trước khi tắt khu vực. Thay đổi bbox không tự cập nhật bản đồ đã tải trên thiết bị.</Notice>{can('system.manage_constants') && <button className="primary-button">Lưu khu vực</button>}</fieldset></form></>
}
