import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { activeTask, assetUrl, dateLabel, emptyContent, enqueue, poiName, stamp, uid, useAdmin, type Content, type Data, type Permission, type Poi, type Zone } from './store'
import { CrudDialog, Empty, Field, Heading, Notice, Status, usePagination } from './ui'

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
  const [message, setMessage] = useState('')
  if (id !== 'new' && !original) return <Empty text="Không tìm thấy khu vực." />
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      const [minLng, minLat, maxLng, maxLat] = draft.map_region.bbox
      if (!draft.name.trim() || draft.name.length > 100 || data.zones.some(zone => zone.zone_id !== draft.zone_id && zone.name.toLowerCase() === draft.name.trim().toLowerCase())) throw new Error('Tên khu vực cần duy nhất, 1–100 ký tự.')
      if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite) || minLng >= maxLng || minLat >= maxLat || maxLng - minLng > 1 || maxLat - minLat > 1 || minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) throw new Error('Bounding box hợp lệ, min < max; mỗi chiều tối đa 1°.')
      if (draft.map_region.min_zoom > draft.map_region.max_zoom) throw new Error('Zoom nhỏ nhất không vượt zoom lớn nhất.')
      const body = { name: draft.name.trim(), map_region: draft.map_region, is_active: draft.is_active }
      await mutate({ permission: 'system.manage_constants', path: original ? `/admin/zones/${id}` : '/admin/zones', method: original ? 'PUT' : 'POST', body, action: original ? 'zone.update' : 'zone.create', target: draft.zone_id, before: original, after: body, demo: current => ({ ...current, zones: original ? current.zones.map(zone => zone.zone_id === id ? { ...draft, ...body } : zone) : [...current.zones, { ...draft, ...body }] }) }); navigate('/zones')
    } catch (error) { setMessage((error as Error).message) }
  }
  return <><Heading title={original ? original.name : 'Tạo khu vực'} detail="Tọa độ WGS84, thứ tự bbox: kinh độ min, vĩ độ min, kinh độ max, vĩ độ max."><button className="secondary-button" onClick={() => navigate('/zones')}>Về danh sách</button></Heading>{message && <Notice>{message}</Notice>}<form className="panel admin-form" onSubmit={save}><fieldset disabled={!can('system.manage_constants') || busy}><Field label="Tên khu vực"><input required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><div className="form-grid">{['Kinh độ nhỏ nhất', 'Vĩ độ nhỏ nhất', 'Kinh độ lớn nhất', 'Vĩ độ lớn nhất'].map((label, index) => <Field key={label} label={label}><input required type="number" step="any" min={index % 2 ? -90 : -180} max={index % 2 ? 90 : 180} value={draft.map_region.bbox[index]} onChange={event => setDraft({ ...draft, map_region: { ...draft.map_region, bbox: draft.map_region.bbox.map((value, position) => position === index ? event.target.valueAsNumber : value) } })} /></Field>)}{(['min_zoom', 'max_zoom'] as const).map(key => <Field key={key} label={key === 'min_zoom' ? 'Zoom nhỏ nhất' : 'Zoom lớn nhất'}><input required type="number" min={0} max={22} step={1} value={draft.map_region[key]} onChange={event => setDraft({ ...draft, map_region: { ...draft.map_region, [key]: event.target.valueAsNumber } })} /></Field>)}</div><label className="admin-check"><input type="checkbox" checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} />Khu vực đang bật</label><Notice>Không yêu cầu tắt các POI trước khi tắt khu vực. Thay đổi bbox không tự cập nhật bản đồ đã tải trên thiết bị.</Notice>{can('system.manage_constants') && <button className="primary-button">Lưu khu vực</button>}</fieldset></form></>
}
function contentStatus(poi: Poi, locale: string, data: Data) {
  if (poi.content[locale]?.audio_url) return 'ready'
  const tasks = data.tasks.filter(task => task.poi_id === poi.poi_id && task.language_code === locale).sort((first, second) => second.created_at.localeCompare(first.created_at))
  if (tasks.some(activeTask)) return 'pending'
  return tasks[0]?.status === 'failed' ? 'failed' : poi.content_status?.[locale] || 'missing'
}
function PoiContentEditor({ poi }: { poi: Poi }) {
  const { data, can, mutate, user, mode, busy } = useAdmin()
  const [locale, setLocale] = useState('vi')
  const [draft, setDraft] = useState<Content>(poi.content.vi || emptyContent())
  const [message, setMessage] = useState('')
  const [locales, setLocales] = useState<string[]>(['vi'])
  const [retranslate, setRetranslate] = useState(false)
  const [replace, setReplace] = useState(false)
  useEffect(() => { setDraft(poi.content[locale] || emptyContent()) }, [poi, locale])
  const enabled = data.languages.some(language => language.code === locale && language.is_active)
  const editable = can('poi.edit') && poi.status !== 'archived' && enabled
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      if (!draft.name.trim() || !draft.text.trim()) throw new Error('Tên và thuyết minh không được trống.')
      const content = { ...draft, name: draft.name.trim(), text: draft.text.trim(), is_edited: locale !== 'vi', updated_at: stamp() }
      const next = { ...poi, content: { ...poi.content, [locale]: content }, updated_at: stamp(), last_modified_by: user!.user_id }
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/content/${locale}`, method: 'PUT', body: { name: content.name, text: content.text }, action: 'poi.content_edit', target: `${poi.poi_id}:${locale}`, before: { name: poi.content[locale]?.name, text: poi.content[locale]?.text }, after: { name: content.name, text: content.text }, demo: current => { const updated = { ...current, pois: current.pois.map(item => item.poi_id === poi.poi_id ? next : item) }; return enqueue(updated, next, locale === 'vi' ? current.languages.filter(language => language.is_active).map(language => language.code) : [locale], user!.user_id) } })
      setMessage('Đã lưu nội dung; audio TTS được xếp hàng khi cần. Audio tải lên được giữ nguyên.')
    } catch (error) { setMessage((error as Error).message) }
  }
  async function upload(file?: File) {
    if (!file) return
    try {
      if (mode === 'demo') throw new Error('Tải audio cần backend thật.')
      if (file.type !== 'audio/mpeg' || file.size > 15 * 1024 * 1024) throw new Error('Chọn MP3 (audio/mpeg), tối đa 15 MB.')
      const body = new FormData(); body.set('file', file)
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/content/${locale}/audio`, body, action: 'poi.audio_upload', target: `${poi.poi_id}:${locale}`, demo: current => current })
      setMessage('Đã tải audio; backend tính SHA-256 và bảo vệ file khỏi TTS ghi đè.')
    } catch (error) { setMessage((error as Error).message) }
  }
  async function regenerate() {
    try {
      if (!locales.length) throw new Error('Chọn ít nhất một ngôn ngữ đang bật.')
      if ((replace || retranslate) && !window.confirm('Thao tác có thể ghi đè bản dịch thủ công hoặc audio tải lên. Tiếp tục?')) return
      const result = await mutate<{ tasks_created: string[]; skipped: { locale: string; reason: string }[] }>({ permission: 'audio.trigger_regenerate', path: `/admin/pois/${poi.poi_id}/audio/regenerate`, body: { locales, retranslate, replace_uploaded_audio: replace }, action: 'audio.regenerate', target: poi.poi_id, after: { locales, retranslate, replace_uploaded_audio: replace }, demo: current => enqueue(current, poi, locales, user!.user_id, replace, retranslate) })
      setMessage(result ? `Đã tạo ${result.tasks_created.length} tác vụ. ${result.skipped.map(item => `${item.locale}: ${item.reason}`).join('; ')}` : 'Đã xếp hàng tác vụ; tác vụ đang hoạt động được bỏ qua.')
    } catch (error) { setMessage((error as Error).message) }
  }
  return <div className="admin-form">{message && <Notice>{message}</Notice>}<Field label="Ngôn ngữ biên tập"><select value={locale} onChange={event => { if ((draft.name !== (poi.content[locale]?.name || '') || draft.text !== (poi.content[locale]?.text || '')) && !window.confirm('Bỏ thay đổi chưa lưu để đổi ngôn ngữ?')) return; setLocale(event.target.value) }}>{data.languages.map(language => <option key={language.code} value={language.code}>{language.native_name}{language.code === 'vi' ? ' · Ngôn ngữ gốc' : ''}{language.is_active ? '' : ' (đã tắt, chỉ đọc)'}</option>)}</select></Field><form className="admin-form" onSubmit={save}><fieldset disabled={!editable || busy}><Field label="Tên POI (tối đa 200 ký tự)"><input required maxLength={200} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Thuyết minh (tối đa 5.000 ký tự)"><textarea required rows={7} maxLength={5000} value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} /></Field>{editable && <button className="primary-button">Lưu nội dung {locale.toUpperCase()}</button>}</fieldset></form><small>{draft.is_edited ? 'Bản dịch đã sửa tay — không tự động ghi đè' : 'Nội dung nguồn / bản dịch tự động'} · {dateLabel(draft.updated_at)}</small><div><Status value={contentStatus(poi, locale, data)} /><p>Nguồn audio: <strong>{poi.content[locale]?.audio_source || 'Chưa có'}</strong></p>{assetUrl(poi.content[locale]?.audio_url || null) && <audio key={poi.content[locale]?.audio_sha256 || poi.updated_at} controls preload="none" src={assetUrl(poi.content[locale].audio_url)} />}<small className="admin-block">SHA-256: {poi.content[locale]?.audio_sha256 || 'Chưa có'}</small></div>{editable && <Field label="Tải audio thu sẵn (MP3, tối đa 15 MB)"><input type="file" accept="audio/mpeg,.mp3" disabled={busy || mode === 'demo'} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></Field>}{can('audio.trigger_regenerate') && poi.status !== 'archived' && <section className="regenerate-panel"><h3>Tạo lại audio</h3><div className="admin-actions">{data.languages.filter(language => language.is_active).map(language => <label key={language.code} className="admin-check"><input type="checkbox" checked={locales.includes(language.code)} onChange={event => setLocales(event.target.checked ? [...locales, language.code] : locales.filter(code => code !== language.code))} />{language.native_name}</label>)}</div><label className="admin-check"><input type="checkbox" checked={retranslate} onChange={event => setRetranslate(event.target.checked)} />Dịch lại cả bản đã biên tập thủ công</label><label className="admin-check"><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} />Cho phép ghi đè audio tải lên</label><button className="secondary-button" disabled={busy || !locales.length} onClick={() => void regenerate()}>Xếp hàng tạo audio</button></section>}</div>
}
function PoiImages({ poi }: { poi: Poi }) {
  const { can, mode, busy, mutate } = useAdmin()
  const [message, setMessage] = useState('')
  const editable = can('poi.edit') && poi.status !== 'archived'
  async function upload(file?: File) {
    if (!file) return
    try {
      if (mode === 'demo') throw new Error('Tải ảnh cần backend thật.')
      if (poi.images.length >= 10 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Tối đa 10 ảnh, JPG/PNG/WebP, tối đa 5 MB/ảnh.')
      const body = new FormData(); body.set('file', file)
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/images`, body, action: 'poi.image_add', target: poi.poi_id, demo: current => current }); setMessage('Đã tải ảnh; backend tối ưu thành JPEG, cạnh dài tối đa 1600 px.')
    } catch (error) { setMessage((error as Error).message) }
  }
  async function remove(image: string) {
    if (!window.confirm('Xóa ảnh này khỏi POI và máy chủ?')) return
    try { await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/images/${encodeURIComponent(image.split('/').pop() || '')}`, method: 'DELETE', action: 'poi.image_remove', target: poi.poi_id, before: { image }, demo: current => ({ ...current, pois: current.pois.map(item => item.poi_id === poi.poi_id ? { ...item, images: item.images.filter(value => value !== image), updated_at: stamp() } : item) }) }) } catch (error) { setMessage((error as Error).message) }
  }
  return <div className="admin-form">{message && <Notice>{message}</Notice>}<p>{poi.images.length}/10 ảnh</p>{editable && <Field label="Thêm ảnh JPG/PNG/WebP (tối đa 5 MB)"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || mode === 'demo' || poi.images.length >= 10} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></Field>}<div className="admin-image-grid">{poi.images.map((image, index) => <figure key={image}><img src={assetUrl(image)} alt={`Ảnh ${poiName(poi)} ${index + 1}`} />{editable && <button className="text-button" disabled={busy} onClick={() => void remove(image)}>Xóa ảnh</button>}</figure>)}</div>{!poi.images.length && <Empty text="Chưa có ảnh." />}</div>
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
  return <><Heading title="Địa điểm (POI)" detail="Nội dung tiếng Việt gốc, bản dịch và audio theo từng ngôn ngữ.">{can('poi.create') && <button className="primary-button" onClick={() => navigate('/pois/new')}>+ Tạo POI</button>}</Heading><section className="panel"><div className="filter-row"><input className="select-control" placeholder="Tìm tên tiếng Việt…" aria-label="Tìm POI" value={query} onChange={event => setQuery(event.target.value)} /><select className="select-control" aria-label="Khu vực" value={zone} onChange={event => setZone(event.target.value)}><option value="">Tất cả khu vực</option>{data.zones.map(item => <option key={item.zone_id} value={item.zone_id}>{item.name}</option>)}</select><select className="select-control" aria-label="Trạng thái" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="published">Công khai</option><option value="unpublished">Đã gỡ công khai</option><option value="archived">Đã lưu trữ</option></select><select className="select-control" aria-label="Danh mục" value={category} onChange={event => setCategory(event.target.value)}><option value="">Tất cả danh mục</option>{[...new Set(data.pois.map(poi => poi.category))].map(value => <option key={value}>{value}</option>)}</select><select className="select-control" aria-label="Sắp xếp" value={sort} onChange={event => setSort(event.target.value)}><option value="updated_at_desc">Mới cập nhật</option><option value="name_asc">Tên A–Z</option><option value="created_at_desc">Mới tạo</option></select><label className="admin-check"><input type="checkbox" checked={missing} onChange={event => setMissing(event.target.checked)} />Thiếu audio</label><button className="text-button" onClick={() => { setQuery(''); setZone(''); setStatus(''); setCategory(''); setMissing(false) }}>Xóa bộ lọc</button></div><div className="table-wrap"><table><thead><tr><th>Địa điểm</th><th>Khu vực</th><th>Nội dung / audio</th><th>Trạng thái</th><th>Cập nhật</th><th /></tr></thead><tbody>{pagination.rows.map(poi => <tr key={poi.poi_id}><td><strong>{poiName(poi)}</strong><small className="admin-block">{poi.category} · {poi.geofence_radius_m} m</small></td><td>{data.zones.find(item => item.zone_id === poi.zone_id)?.name}</td><td>{languages.map(language => <div key={language.code} className="locale-status">{language.code.toUpperCase()} <Status value={contentStatus(poi, language.code, data)} /></div>)}</td><td><Status value={poi.status} /></td><td>{dateLabel(poi.updated_at)}</td><td><button className="text-button" onClick={() => navigate(`/pois/${poi.poi_id}`)}>Chi tiết →</button></td></tr>)}</tbody></table></div>{!rows.length && <Empty />}{pagination.controls}</section></>
}
export function PoiEditor({ id }: { id: string }) {
  const { data, can, mutate, user, mode, busy } = useAdmin()
  const navigate = useNavigate()
  const original = data.pois.find(poi => poi.poi_id === id)
  const [draft, setDraft] = useState<Poi>(() => original ? structuredClone(original) : { poi_id: uid('poi'), zone_id: data.zones.find(zone => zone.is_active)?.zone_id || '', category: '', location: { lat: 10.7726, lng: 106.698 }, geofence_radius_m: 30, qr_code: null, status: 'published', images: [], content: { vi: emptyContent() }, last_modified_by: user!.user_id, created_at: stamp(), updated_at: stamp() })
  const [tab, setTab] = useState('Thông tin')
  const [message, setMessage] = useState('')
  const [transition, setTransition] = useState<'unpublish' | 'republish' | 'archive' | null>(null)
  const [reason, setReason] = useState('')
  useEffect(() => { if (original) setDraft(structuredClone(original)) }, [original])
  const editable = can(original ? 'poi.edit' : 'poi.create') && original?.status !== 'archived'
  if (id !== 'new' && !original) return <Empty text="Không tìm thấy POI." />
  if (id === 'new' && !can('poi.create')) return <Empty text="Bạn không có quyền tạo POI." />
  async function save(event: FormEvent) {
    event.preventDefault(); setMessage('')
    try {
      if (!editable) throw new Error('Không được sửa POI này.')
      if (!data.zones.some(zone => zone.zone_id === draft.zone_id && (zone.is_active || original?.zone_id === zone.zone_id))) throw new Error('Chọn khu vực đang hoạt động.')
      if (!draft.category.trim() || draft.category.length > 50 || !Number.isInteger(draft.geofence_radius_m) || draft.geofence_radius_m < 10 || draft.geofence_radius_m > 200) throw new Error('Danh mục 1–50 ký tự; bán kính 10–200 m.')
      const source = draft.content.vi
      if (!source?.name.trim() || source.name.length > 200 || !source.text.trim() || source.text.length > 5000) throw new Error('Cần tên tiếng Việt (1–200 ký tự) và thuyết minh tiếng Việt (1–5000 ký tự).')
      const next = { ...draft, updated_at: stamp(), last_modified_by: user!.user_id }
      const body = { category: draft.category.trim(), zone_id: draft.zone_id, location: draft.location, geofence_radius_m: draft.geofence_radius_m, ...(!original ? { content: { vi: { name: source.name.trim(), text: source.text.trim() } } } : {}) }
      const result = await mutate<{ poi: Poi }>({ permission: original ? 'poi.edit' : 'poi.create', path: original ? `/admin/pois/${id}` : '/admin/pois', method: original ? 'PUT' : 'POST', body, action: original ? 'poi.update' : 'poi.create', target: draft.poi_id, before: original ? { category: original.category, zone_id: original.zone_id, location: original.location, geofence_radius_m: original.geofence_radius_m } : null, after: body, demo: current => { const updated = { ...current, pois: original ? current.pois.map(poi => poi.poi_id === id ? next : poi) : [...current.pois, next] }; return original ? updated : enqueue(updated, next, current.languages.filter(language => language.is_active).map(language => language.code), user!.user_id) } })
      setMessage('Đã lưu POI.'); if (!original) navigate(`/pois/${result?.poi.poi_id || draft.poi_id}`, { replace: true })
    } catch (error) { setMessage((error as Error).message) }
  }
  async function changeStatus(event: FormEvent) {
    event.preventDefault(); if (!original || !transition) return
    const status = transition === 'archive' ? 'archived' : transition === 'unpublish' ? 'unpublished' : 'published'
    const permission: Permission = transition === 'archive' ? 'poi.delete' : transition === 'unpublish' ? 'content.unpublish' : 'content.restore'
    try {
      await mutate({ permission, path: `/admin/pois/${id}${transition === 'archive' ? '' : `/${transition}`}`, method: transition === 'archive' ? 'DELETE' : 'POST', body: transition === 'unpublish' ? { reason: reason.trim() } : undefined, action: transition === 'archive' ? 'poi.delete' : permission, target: id, before: { status: original.status }, after: { status, ...(transition === 'unpublish' ? { unpublish_reason: reason.trim() } : {}) }, demo: current => ({ ...current, pois: current.pois.map(poi => poi.poi_id === id ? { ...poi, status, unpublish_reason: transition === 'unpublish' ? reason.trim() : null, updated_at: stamp(), last_modified_by: user!.user_id } : poi), tasks: transition === 'archive' ? current.tasks.map(task => task.poi_id === id && activeTask(task) ? { ...task, status: 'cancelled' } : task) : current.tasks }) })
      setTransition(null); setReason(''); setMessage('Đã cập nhật trạng thái.')
    } catch (error) { setMessage((error as Error).message) }
  }
  async function qr(regenerate: boolean) {
    if (regenerate && !window.confirm('Tạo mã mới? Mã QR cũ sẽ không còn hiệu lực.')) return
    const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), value => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[value % 32]).join('')
    const qr_code = `QR-${id.toUpperCase().replaceAll('_', '-')}${regenerate ? `-${suffix}` : ''}`
    try { await mutate({ permission: 'poi.assign_qr', path: `/admin/pois/${id}/qr`, body: { regenerate }, action: 'poi.assign_qr', target: id, before: { qr_code: original?.qr_code }, after: { qr_code }, demo: current => ({ ...current, pois: current.pois.map(poi => poi.poi_id === id ? { ...poi, qr_code, updated_at: stamp(), last_modified_by: user!.user_id } : poi) }) }); setMessage('Đã cấp mã QR.') } catch (error) { setMessage((error as Error).message) }
  }
  return <><Heading title={original ? poiName(original) : 'Tạo địa điểm'} detail="Mọi thay đổi nội dung và tài nguyên được lưu riêng, theo quyền tương ứng."><button className="secondary-button" onClick={() => navigate('/pois')}>Về danh sách</button>{original?.status === 'published' && can('content.unpublish') && <button className="secondary-button" disabled={busy} onClick={() => setTransition('unpublish')}>Gỡ công khai</button>}{original?.status === 'unpublished' && can('content.restore') && <button className="primary-button" disabled={busy} onClick={() => setTransition('republish')}>Đăng lại</button>}{original && original.status !== 'archived' && can('poi.delete') && <button className="danger-button" disabled={busy} onClick={() => setTransition('archive')}>Xóa mềm</button>}</Heading>{message && <Notice>{message}</Notice>}{original && <Notice><Status value={original.status} /> {original.unpublish_reason && `Lý do: ${original.unpublish_reason}`}{original.status === 'archived' && ' · Chỉ đọc; không thể đăng lại.'}</Notice>}<section className="panel"><div className="tabs">{(original ? ['Thông tin', 'Nội dung & audio', 'Hình ảnh', 'QR', 'Nhật ký'] : ['Thông tin']).map(name => <button key={name} className={tab === name ? 'tab-active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
    {tab === 'Thông tin' && <form className="admin-form" onSubmit={save}><fieldset disabled={!editable || busy}><div className="form-grid"><Field label="Khu vực"><select required value={draft.zone_id} onChange={event => setDraft({ ...draft, zone_id: event.target.value })}><option value="">Chọn khu vực</option>{data.zones.filter(zone => zone.is_active || zone.zone_id === original?.zone_id).map(zone => <option key={zone.zone_id} value={zone.zone_id}>{zone.name}{zone.is_active ? '' : ' (đã tắt)'}</option>)}</select></Field><Field label="Danh mục"><input required maxLength={50} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} /></Field><Field label="Vĩ độ"><input required type="number" min="-90" max="90" step="any" value={draft.location.lat} onChange={event => setDraft({ ...draft, location: { ...draft.location, lat: event.target.valueAsNumber } })} /></Field><Field label="Kinh độ"><input required type="number" min="-180" max="180" step="any" value={draft.location.lng} onChange={event => setDraft({ ...draft, location: { ...draft.location, lng: event.target.valueAsNumber } })} /></Field><Field label="Bán kính kích hoạt (10–200 m)"><input required type="number" min="10" max="200" step="1" value={draft.geofence_radius_m} onChange={event => setDraft({ ...draft, geofence_radius_m: event.target.valueAsNumber })} /></Field></div>{!original && <><Field label="Tên tiếng Việt"><input required maxLength={200} value={draft.content.vi.name} onChange={event => setDraft({ ...draft, content: { vi: { ...draft.content.vi, name: event.target.value } } })} /></Field><Field label="Thuyết minh tiếng Việt"><textarea required maxLength={5000} rows={7} value={draft.content.vi.text} onChange={event => setDraft({ ...draft, content: { vi: { ...draft.content.vi, text: event.target.value } } })} /></Field><Notice>POI mới được công khai; backend xếp hàng dịch và tạo audio cho các ngôn ngữ đang bật.</Notice></>}{editable && <button className="primary-button">Lưu thông tin</button>}</fieldset><small>Cập nhật: {dateLabel(original?.updated_at)} · {original?.last_modified_by}</small></form>}
    {tab === 'Nội dung & audio' && original && <PoiContentEditor poi={original} />}
    {tab === 'Hình ảnh' && original && <PoiImages poi={original} />}
    {tab === 'QR' && original && <div className="admin-form"><Field label="Mã QR do server cấp"><input readOnly value={original.qr_code || ''} placeholder="Chưa cấp mã" /></Field><div className="admin-actions">{can('poi.assign_qr') && original.status !== 'archived' && <button className="primary-button" disabled={busy} onClick={() => void qr(Boolean(original.qr_code))}>{original.qr_code ? 'Tạo lại mã QR' : 'Cấp mã QR'}</button>}{original.qr_code && <button className="secondary-button" onClick={() => { void navigator.clipboard.writeText(original.qr_code!).then(() => setMessage('Đã sao chép mã.')).catch(() => setMessage('Không truy cập được clipboard. Hãy sao chép từ ô mã.')) }}>Sao chép</button>}</div><Notice>{original.qr_code ? 'Mã QR đã được cấp cho địa điểm.' : 'Chưa cấp mã QR.'}</Notice></div>}
    {tab === 'Nhật ký' && (can('audit.view') ? <>{data.audit.filter(log => log.target_id === id || log.target_id.startsWith(id + ':')).map(log => <details key={log.log_id} className="audit-entry"><summary>{log.action} · {dateLabel(log.timestamp)}</summary><pre>{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre></details>)}</> : <Empty text="Bạn không có quyền xem nhật ký." />)}</section>
    {transition && <CrudDialog title={transition === 'archive' ? 'Xóa mềm POI' : transition === 'unpublish' ? 'Gỡ công khai POI' : 'Đăng lại POI'} onClose={() => { if (!busy) setTransition(null) }}><form className="admin-form" onSubmit={changeStatus}>{transition === 'unpublish' ? <Field label="Lý do (5–500 ký tự)"><textarea required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></Field> : <Notice>{transition === 'archive' ? 'POI sẽ được lưu trữ, ẩn khỏi ứng dụng và hủy tác vụ chưa kết thúc. Không thể đăng lại.' : 'POI sẽ xuất hiện lại trên ứng dụng du khách.'}</Notice>}<button className="primary-button" disabled={busy || (transition === 'unpublish' && reason.trim().length < 5)}>Xác nhận</button>{message && <Notice>{message}</Notice>}</form></CrudDialog>}</>
}
