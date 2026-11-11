import { toast } from 'sonner'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { activeTask, dateLabel, emptyContent, enqueue, poiName, stamp, uid, useAdmin } from '../../admin/store'
import type { Content, Data, Permission, Poi, Zone } from '../../admin/types'
import { assetUrl } from '../../admin/api'
import { ContentFields, PoiContentEditor } from './PoiContent'
import { PoiImages, PoiQr } from './PoiMedia'
import { categories, PoiReview, publicationIssues } from './PoiReview'
import { CrudDialog, Empty, Field, Heading, Notice, Status, usePagination } from '../../shared/ui'

function contentStatus(poi: Poi, locale: string, data: Data) {
  if (poi.content[locale]?.audio_url) return 'ready'
  const tasks = data.tasks.filter(task => task.poi_id === poi.poi_id && task.language_code === locale).sort((first, second) => second.created_at.localeCompare(first.created_at))
  if (tasks.some(activeTask)) return 'pending'
  return tasks[0]?.status === 'failed' ? 'failed' : poi.content_status?.[locale] || 'missing'
}
export function Pois() {
  const { data, can } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [zone, setZone] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('updated_at_desc')
  const [missing, setMissing] = useState(new URLSearchParams(location.search).get('filter') === 'missing-audio')
  const languages = data.languages.filter(language => language.is_active)
  const rows = data.pois.filter(poi => poiName(poi).toLowerCase().includes(query.toLowerCase()) && (!zone || poi.zone_id === zone) && (!status || poi.status === status) && (!category || poi.category === category) && (!missing || languages.some(language => !poi.content[language.code]?.audio_url))).sort((first, second) => sort === 'name_asc' ? poiName(first).localeCompare(poiName(second), 'vi') : sort === 'created_at_desc' ? second.created_at.localeCompare(first.created_at) : second.updated_at.localeCompare(first.updated_at))
  const pagination = usePagination(rows)
  return <><Heading title="Địa điểm (POI)" detail="Nội dung tiếng Việt gốc, bản dịch và audio theo từng ngôn ngữ.">{can('poi.create') && <button className="primary-button" onClick={() => navigate('/pois/new')}>+ Tạo POI</button>}</Heading><section className="panel"><div className="filter-row"><input className="select-control" placeholder="Tìm tên tiếng Việt…" aria-label="Tìm POI" value={query} onChange={event => setQuery(event.target.value)} /><select className="select-control" aria-label="Khu vực" value={zone} onChange={event => setZone(event.target.value)}><option value="">Tất cả khu vực</option>{data.zones.map(item => <option key={item.zone_id} value={item.zone_id}>{item.name}</option>)}</select><select className="select-control" aria-label="Trạng thái" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="published">Công khai</option><option value="unpublished">Chưa công khai</option><option value="archived">Đã lưu trữ</option></select><select className="select-control" aria-label="Danh mục" value={category} onChange={event => setCategory(event.target.value)}><option value="">Tất cả danh mục</option>{[...new Set(data.pois.map(poi => poi.category))].map(value => <option key={value}>{value}</option>)}</select><select className="select-control" aria-label="Sắp xếp" value={sort} onChange={event => setSort(event.target.value)}><option value="updated_at_desc">Mới cập nhật</option><option value="name_asc">Tên A–Z</option><option value="created_at_desc">Mới tạo</option></select><label className="admin-check"><input type="checkbox" checked={missing} onChange={event => setMissing(event.target.checked)} />Thiếu audio</label><button className="text-button" onClick={() => { setQuery(''); setZone(''); setStatus(''); setCategory(''); setMissing(false) }}>Xóa bộ lọc</button></div><div className="table-wrap"><table><thead><tr><th>Địa điểm</th><th>Khu vực</th><th>Nội dung / audio</th><th>Trạng thái</th><th>Cập nhật</th><th /></tr></thead><tbody>{pagination.rows.map(poi => <tr key={poi.poi_id}><td><strong>{poiName(poi)}</strong><small className="admin-block">{categories[poi.category] || poi.category} · {poi.geofence_radius_m} m</small></td><td>{data.zones.find(item => item.zone_id === poi.zone_id)?.name}</td><td>{languages.map(language => <div key={language.code} className="locale-status">{language.code.toUpperCase()} <Status value={contentStatus(poi, language.code, data)} /></div>)}</td><td><Status value={poi.status} /></td><td>{dateLabel(poi.updated_at)}</td><td><button className="text-button" onClick={() => navigate(`/pois/${poi.poi_id}`)}>Chi tiết →</button></td></tr>)}</tbody></table></div>{!rows.length && <Empty />}{pagination.controls}</section></>
}
export function PoiEditor({ id }: { id: string }) {
  const { data, can, mutate, user, mode, busy, localDatabase } = useAdmin()
  const navigate = useNavigate()
  const original = data.pois.find(poi => poi.poi_id === id)
  const [draft, setDraft] = useState<Poi>(() => original ? structuredClone(original) : { poi_id: uid('poi'), zone_id: data.zones.find(zone => zone.is_active)?.zone_id || '', category: 'heritage', location: { lat: 10.7726, lng: 106.698 }, geofence_radius_m: 30, qr_code: null, status: 'unpublished', images: [], content: { vi: emptyContent() }, last_modified_by: user!.user_id, created_at: stamp(), updated_at: stamp() })
  const [tab, setTab] = useState('Thông tin')

  const [transition, setTransition] = useState<'unpublish' | 'republish' | 'archive' | null>(null)
  const [reason, setReason] = useState('')
  const [infoDirty, setInfoDirty] = useState(false)
  useEffect(() => { if (original && !infoDirty) setDraft(structuredClone(original)) }, [original, infoDirty])
  const editable = can(original ? 'poi.edit' : 'poi.create') && original?.status !== 'archived'
  if (id !== 'new' && !original) return <Empty text="Không tìm thấy POI." />
  if (id === 'new' && !can('poi.create')) return <Empty text="Bạn không có quyền tạo POI." />
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      if (!editable) throw new Error('Không được sửa POI này.')
      if (!data.zones.some(zone => zone.zone_id === draft.zone_id && (zone.is_active || original?.zone_id === zone.zone_id))) throw new Error('Chọn khu vực đang hoạt động.')
      if (!draft.category.trim() || draft.category.length > 50 || !Number.isInteger(draft.geofence_radius_m) || draft.geofence_radius_m < 10 || draft.geofence_radius_m > 200) throw new Error('Danh mục 1–50 ký tự; bán kính 10–200 m.')
      const source = draft.content.vi
      if (!source?.name.trim() || source.name.length > 200 || !source.text.trim() || source.text.length > 5000) throw new Error('Cần tên tiếng Việt (1–200 ký tự) và thuyết minh tiếng Việt (1–5000 ký tự).')
      const next = { ...draft, updated_at: stamp(), last_modified_by: user!.user_id }
      const body = { category: draft.category.trim(), zone_id: draft.zone_id, location: draft.location, geofence_radius_m: draft.geofence_radius_m, ...(!original ? { content: { vi: { name: source.name.trim(), address: source.address?.trim() || null, description: source.description?.trim() || null, introduction: source.introduction?.trim() || null, text: source.text.trim() } } } : {}) }
      const result = await mutate<{ poi: Poi }>({ permission: original ? 'poi.edit' : 'poi.create', path: original ? `/admin/pois/${id}` : '/admin/pois', method: original ? 'PUT' : 'POST', body, action: original ? 'poi.update' : 'poi.create', target: draft.poi_id, before: original ? { category: original.category, zone_id: original.zone_id, location: original.location, geofence_radius_m: original.geofence_radius_m } : null, after: body, demo: current => { const updated = { ...current, pois: original ? current.pois.map(poi => poi.poi_id === id ? next : poi) : [...current.pois, next] }; return original ? updated : enqueue(updated, next, current.languages.filter(language => language.is_active).map(language => language.code), user!.user_id) } })
      setInfoDirty(false); toast.success('Đã lưu POI.'); if (!original) navigate(`/pois/${result?.poi.poi_id || draft.poi_id}`, { replace: true })
    } catch (error) { toast.error((error as Error).message) }
  }
  async function changeStatus(event: FormEvent) {
    event.preventDefault(); if (!original || !transition) return
    const status = transition === 'archive' ? 'archived' : transition === 'unpublish' ? 'unpublished' : 'published'
    const permission: Permission = transition === 'archive' ? 'poi.delete' : transition === 'unpublish' ? 'content.unpublish' : 'content.restore'
    try {
      if (transition === 'republish' && (publicationIssues(original).length || !data.zones.some(zone => zone.zone_id === original.zone_id && zone.is_active))) throw new Error('Mở tab Kiểm tra & xem trước để hoàn thiện nội dung, ảnh, audio và khu vực trước khi công khai.')
      await mutate({ permission, path: `/admin/pois/${id}${transition === 'archive' ? '' : `/${transition}`}`, method: transition === 'archive' ? 'DELETE' : 'POST', body: transition === 'unpublish' ? { reason: reason.trim() } : undefined, action: transition === 'archive' ? 'poi.delete' : permission, target: id, before: { status: original.status }, after: { status, ...(transition === 'unpublish' ? { unpublish_reason: reason.trim() } : {}) }, demo: current => ({ ...current, pois: current.pois.map(poi => poi.poi_id === id ? { ...poi, status, unpublish_reason: transition === 'unpublish' ? reason.trim() : null, updated_at: stamp(), last_modified_by: user!.user_id } : poi), tasks: transition === 'archive' ? current.tasks.map(task => task.poi_id === id && activeTask(task) ? { ...task, status: 'cancelled' } : task) : current.tasks }) })
      setTransition(null); setReason(''); toast.success('Đã cập nhật trạng thái.')
    } catch (error) { toast.error((error as Error).message) }
  }
  async function qr(regenerate: boolean) {
    if (regenerate && !window.confirm('Tạo mã mới? Mã QR cũ sẽ không còn hiệu lực.')) return
    const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), value => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[value % 32]).join('')
    const qr_code = `QR-${id.toUpperCase().replaceAll('_', '-')}${regenerate ? `-${suffix}` : ''}`
    try { await mutate({ permission: 'poi.assign_qr', path: `/admin/pois/${id}/qr`, body: { regenerate }, action: 'poi.assign_qr', target: id, before: { qr_code: original?.qr_code }, after: { qr_code }, demo: current => ({ ...current, pois: current.pois.map(poi => poi.poi_id === id ? { ...poi, qr_code, updated_at: stamp(), last_modified_by: user!.user_id } : poi) }) }); toast.success('Đã cấp mã QR.') } catch (error) { toast.error((error as Error).message) }
  }
  return <><Heading title={original ? poiName(original) : 'Tạo địa điểm'} detail="Mọi thay đổi nội dung và tài nguyên được lưu riêng, theo quyền tương ứng."><button className="secondary-button" onClick={() => navigate('/pois')}>Về danh sách</button>{original?.status === 'published' && can('content.unpublish') && <button className="secondary-button" disabled={busy} onClick={() => setTransition('unpublish')}>Gỡ công khai</button>}{original?.status === 'unpublished' && can('content.restore') && <button className="primary-button" disabled={busy} onClick={() => setTransition('republish')}>Công khai</button>}{original && original.status !== 'archived' && can('poi.delete') && <button className="danger-button" disabled={busy} onClick={() => setTransition('archive')}>Xóa mềm</button>}</Heading>{original && <Notice><Status value={original.status} /> {original.unpublish_reason && `Lý do: ${original.unpublish_reason}`}{original.status === 'archived' && ' · Chỉ đọc; không thể đăng lại.'}</Notice>}<section className="panel"><div className="tabs">{(original ? ['Thông tin', 'Nội dung & audio', 'Hình ảnh', 'QR', 'Kiểm tra & xem trước', 'Nhật ký'] : ['Thông tin']).map(name => <button key={name} className={tab === name ? 'tab-active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
    {tab === 'Thông tin' && <form className="admin-form" onSubmit={save} onChange={() => setInfoDirty(true)}><fieldset disabled={!editable || busy}><div className="form-grid"><Field label="Khu vực"><select required value={draft.zone_id} onChange={event => setDraft({ ...draft, zone_id: event.target.value })}><option value="">Chọn khu vực</option>{data.zones.filter(zone => zone.is_active || zone.zone_id === original?.zone_id).map(zone => <option key={zone.zone_id} value={zone.zone_id}>{zone.name}{zone.is_active ? '' : ' (đã tắt)'}</option>)}</select></Field><Field label="Danh mục"><select required value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{!categories[draft.category] && <option value={draft.category}>Cũ: {draft.category} — chọn lại</option>}{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Vĩ độ"><input required type="number" min="-90" max="90" step="any" value={draft.location.lat} onChange={event => setDraft({ ...draft, location: { ...draft.location, lat: event.target.valueAsNumber } })} /></Field><Field label="Kinh độ"><input required type="number" min="-180" max="180" step="any" value={draft.location.lng} onChange={event => setDraft({ ...draft, location: { ...draft.location, lng: event.target.valueAsNumber } })} /></Field><Field label="Bán kính kích hoạt (10–200 m)"><input required type="number" min="10" max="200" step="1" value={draft.geofence_radius_m} onChange={event => setDraft({ ...draft, geofence_radius_m: event.target.valueAsNumber })} /></Field></div>{!original && <><ContentFields value={draft.content.vi} onChange={content => setDraft({ ...draft, content: { vi: content } })} /><Notice>Địa điểm mới được lưu ở trạng thái chưa công khai. Sau khi tạo, thêm ảnh và audio rồi mở tab Kiểm tra & xem trước để đăng.</Notice></>}{editable && <button className="primary-button">Lưu thông tin</button>}</fieldset><small>Cập nhật: {dateLabel(original?.updated_at)} · {original?.last_modified_by}</small></form>}
    {tab === 'Nội dung & audio' && original && <PoiContentEditor poi={original} />}
    {tab === 'Hình ảnh' && original && <PoiImages poi={original} />}
    {tab === 'QR' && original && <PoiQr poi={original} onAssign={regenerate => void qr(regenerate)} />}
    {tab === 'Kiểm tra & xem trước' && original && <PoiReview poi={original} />}
    {tab === 'Nhật ký' && (can('audit.view') ? <>{data.audit.filter(log => log.target_id === id || log.target_id.startsWith(id + ':')).map(log => <details key={log.log_id} className="audit-entry"><summary>{log.action} · {dateLabel(log.timestamp)}</summary><pre>{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre></details>)}</> : <Empty text="Bạn không có quyền xem nhật ký." />)}</section>
    {transition && <CrudDialog title={transition === 'archive' ? 'Xóa mềm POI' : transition === 'unpublish' ? 'Gỡ công khai POI' : 'Công khai POI'} onClose={() => { if (!busy) setTransition(null) }}><form className="admin-form" onSubmit={changeStatus}>{transition === 'unpublish' ? <Field label="Lý do (5–500 ký tự)"><textarea required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></Field> : <Notice>{transition === 'archive' ? 'POI sẽ được lưu trữ, ẩn khỏi ứng dụng và hủy tác vụ chưa kết thúc. Không thể đăng lại.' : 'POI sẽ xuất hiện lại trên ứng dụng du khách.'}</Notice>}<button className="primary-button" disabled={busy || (transition === 'unpublish' && reason.trim().length < 5)}>Xác nhận</button></form></CrudDialog>}</>
}
