import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { actorId, dateLabel, emptyContent, poiName, stamp, uid, useAdmin, type AudioTask, type Content, type Poi, type Zone } from './store'
import { Empty, Field, Heading, Notice, Status } from './ui'

export function Pois() {
  const { data } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [zone, setZone] = useState('')
  const [status, setStatus] = useState('')
  const [missing, setMissing] = useState(new URLSearchParams(location.search).get('filter') === 'missing-audio')
  const languages = data.languages.filter(language => language.is_active)
  const ready = (poi: Poi) => languages.filter(language => poi.contents.some(content => content.language_code === language.code && content.audio_url)).length
  const rows = data.pois.filter(poi => poiName(poi).toLowerCase().includes(query.toLowerCase()) && (!zone || poi.zone_id === zone) && (!status || poi.status === status) && (!missing || ready(poi) < languages.length))
  return <><Heading title="Địa điểm (POI)" detail={`${data.pois.length} địa điểm · Nội dung và audio theo ngôn ngữ`}><button className="primary-button" onClick={() => navigate('/pois/new')}>+ Tạo POI</button></Heading><section className="panel"><div className="filter-row"><input className="select-control" placeholder="Tìm địa điểm..." aria-label="Tìm địa điểm" value={query} onChange={event => setQuery(event.target.value)} /><select className="select-control" aria-label="Khu vực POI" value={zone} onChange={event => setZone(event.target.value)}><option value="">Tất cả khu vực</option>{data.zones.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="select-control" aria-label="Trạng thái POI" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select><label className="admin-check"><input type="checkbox" checked={missing} onChange={event => setMissing(event.target.checked)} />Thiếu audio</label><button className="text-button" onClick={() => { setQuery(''); setZone(''); setStatus(''); setMissing(false) }}>Xóa bộ lọc</button></div><div className="table-wrap"><table><thead><tr><th>Địa điểm</th><th>Khu vực</th><th>Audio</th><th>Trạng thái</th><th /></tr></thead><tbody>{rows.map(poi => <tr key={poi.id}><td><strong>{poiName(poi)}</strong><small className="admin-block">{poi.category} · Bán kính {poi.radius} m</small></td><td>{data.zones.find(item => item.id === poi.zone_id)?.name}</td><td>{ready(poi)}/{languages.length} ngôn ngữ</td><td><Status value={poi.status} /></td><td><button className="text-button" onClick={() => navigate(`/pois/${poi.id}`)}>Chỉnh sửa →</button></td></tr>)}</tbody></table></div>{!rows.length && <Empty />}</section></>
}

export function PoiEditor({ id }: { id: string }) {
  const { data, commit, can } = useAdmin()
  const navigate = useNavigate()
  const original = data.pois.find(poi => poi.id === id)
  const defaultLanguage = data.languages.find(language => language.is_default)!.code
  const [draft, setDraft] = useState<Poi>(() => original ? structuredClone(original) : { id: uid(), zone_id: data.zones.find(zone => zone.is_active)?.id ?? '', category: '', latitude: 21.0278, longitude: 105.8356, radius: data.defaultRadius, qr_code: `poi-${uid().slice(0, 8)}`, status: 'active', images: [], contents: [emptyContent(defaultLanguage)], last_modified_by: actorId, created_at: stamp(), updated_at: stamp() })
  const [tab, setTab] = useState('Thông tin & vị trí')
  const [language, setLanguage] = useState(defaultLanguage)
  const [message, setMessage] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const content = draft.contents.find(item => item.language_code === language) ?? emptyContent(language)
  const updateContent = (changes: Partial<Content>) => setDraft({ ...draft, contents: [...draft.contents.filter(item => item.language_code !== language), { ...content, ...changes, is_edited: true, updated_at: stamp() }] })
  if (id !== 'new' && !original) return <Empty text="Không tìm thấy POI. Hãy quay lại danh sách địa điểm." />
  function save(event: FormEvent) {
    event.preventDefault()
    const zone = data.zones.find(item => item.id === draft.zone_id)
    if (!zone || (draft.status === 'active' && !zone.is_active)) { setMessage('POI hoạt động phải thuộc một khu vực đang hoạt động.'); setTab('Thông tin & vị trí'); return }
    if (!draft.category.trim() || !Number.isFinite(draft.radius) || !Number.isInteger(draft.radius) || draft.radius < 1 || !Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude) || draft.latitude < zone.min_lat || draft.latitude > zone.max_lat || draft.longitude < zone.min_lng || draft.longitude > zone.max_lng) { setMessage('Điền danh mục, bán kính nguyên dương và tọa độ nằm trong khung khu vực.'); setTab('Thông tin & vị trí'); return }
    if (!draft.contents.find(item => item.language_code === defaultLanguage)?.name.trim()) { setMessage('Cần tên POI bằng ngôn ngữ mặc định.'); setLanguage(defaultLanguage); setTab('Nội dung & audio'); return }
    if (draft.contents.some(item => (item.text.trim() || item.description.trim() || item.audio_url) && !item.name.trim())) { setMessage('Mỗi bản dịch có nội dung cần có tên POI.'); setTab('Nội dung & audio'); return }
    if (!/^[a-zA-Z0-9_-]+$/.test(draft.qr_code) || data.pois.some(poi => poi.id !== draft.id && poi.qr_code === draft.qr_code)) { setMessage('Mã QR chỉ gồm chữ, số, dấu - hoặc _ và phải duy nhất.'); setTab('QR'); return }
    if (draft.contents.some(item => item.audio_url && !/^https:\/\//i.test(item.audio_url))) { setMessage('URL audio phải bắt đầu bằng https://.'); setTab('Nội dung & audio'); return }
    const next = { ...draft, category: draft.category.trim(), updated_at: stamp(), last_modified_by: actorId }
    if (commit('poi.write', original ? 'poi.update' : 'poi.create', next.id, original ?? null, next, current => ({ ...current, pois: original ? current.pois.map(poi => poi.id === next.id ? next : poi) : [...current.pois, next] }))) { setDraft(next); setMessage('Đã lưu POI.'); if (!original) navigate(`/pois/${next.id}`, { replace: true }) }
  }
  function queueAudio() {
    const savedContent = original?.contents.find(item => item.language_code === language)
    if (!original || JSON.stringify(draft) !== JSON.stringify(original)) { setMessage('Lưu thay đổi POI trước khi tạo tác vụ audio.'); return }
    if (!savedContent?.text.trim() || !data.languages.some(item => item.code === language && item.is_active)) { setMessage('Cần nội dung thuyết minh đã lưu và ngôn ngữ đang hoạt động.'); return }
    if (data.tasks.some(task => task.poi_id === draft.id && task.language_code === language && ['QUEUED', 'PROCESSING'].includes(task.state))) { setMessage('Nội dung này đã có tác vụ đang chờ hoặc xử lý.'); return }
    const task: AudioTask = { id: uid(), poi_id: draft.id, language_code: language, state: 'QUEUED', progress: 0, error: '', retry_count: 0, created_by: actorId, created_at: stamp(), started_at: null, finished_at: null }
    if (commit('audio.write', 'audio.create', task.id, null, task, current => ({ ...current, tasks: [task, ...current.tasks] }))) setMessage('Đã thêm tác vụ demo. Theo dõi tại Tác vụ audio; chưa kết nối TTS thật.')
  }
  async function addImages(files: FileList | null) {
    if (!files?.length) return
    const selected = Array.from(files)
    if (draft.images.length + selected.length > 6 || selected.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 350000)) { setMessage('Tối đa 6 ảnh PNG/JPG/WebP, mỗi ảnh tối đa 350 KB để phù hợp bộ nhớ demo.'); return }
    setImageBusy(true)
    try {
      const images = await Promise.all(selected.map(file => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })))
      setDraft(current => ({ ...current, images: [...current.images, ...images] })); setMessage('Đã thêm ảnh vào bản nháp. Bấm Lưu POI để lưu.')
    } catch { setMessage('Không đọc được ảnh. Hãy thử tệp khác.') } finally { setImageBusy(false) }
  }
  return <><Heading title={original ? poiName(original) : 'Tạo địa điểm'} detail="Thông tin địa lý, nội dung đa ngôn ngữ và tài nguyên của POI."><button className="secondary-button" onClick={() => navigate('/pois')}>Về danh sách</button><button form="poi-editor" className="primary-button" disabled={imageBusy}>Lưu POI</button></Heading>{message && <Notice>{message}</Notice>}<form id="poi-editor" className="panel" onSubmit={save}><div className="tabs">{['Thông tin & vị trí', 'Nội dung & audio', 'Hình ảnh', 'QR', 'Nhật ký'].map(name => <button key={name} type="button" className={tab === name ? 'tab-active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
    {tab === 'Thông tin & vị trí' && <div className="form-grid"><Field label="Khu vực"><select required value={draft.zone_id} onChange={event => setDraft({ ...draft, zone_id: event.target.value })}><option value="">Chọn khu vực</option>{data.zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name}{zone.is_active ? '' : ' (ngừng hoạt động)'}</option>)}</select></Field><Field label="Danh mục"><input required value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} placeholder="Di tích, bảo tàng, kiến trúc..." /></Field><Field label="Vĩ độ"><input required type="number" step="any" min="-90" max="90" value={draft.latitude} onChange={event => setDraft({ ...draft, latitude: event.target.valueAsNumber })} /></Field><Field label="Kinh độ"><input required type="number" step="any" min="-180" max="180" value={draft.longitude} onChange={event => setDraft({ ...draft, longitude: event.target.valueAsNumber })} /></Field><Field label="Bán kính kích hoạt (m)"><input required type="number" min="1" step="1" value={draft.radius} onChange={event => setDraft({ ...draft, radius: event.target.valueAsNumber })} /></Field><Field label="Trạng thái"><select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as Poi['status'] })}><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></Field><Notice>Cập nhật: {dateLabel(original?.updated_at ?? null)} · Người sửa: {data.accounts.find(account => account.id === original?.last_modified_by)?.email ?? 'Chưa lưu'}</Notice></div>}
    {tab === 'Nội dung & audio' && <div className="admin-form"><Field label="Ngôn ngữ biên tập"><select value={language} onChange={event => setLanguage(event.target.value)}>{[...data.languages].sort((first, second) => first.display_order - second.display_order).map(item => <option value={item.code} key={item.code}>{item.native_name}{item.is_active ? '' : ' (đã tắt)'}</option>)}</select></Field><Field label="Tên POI theo ngôn ngữ"><input value={content.name} onChange={event => updateContent({ name: event.target.value })} /></Field><Field label="Mô tả"><textarea value={content.description} onChange={event => updateContent({ description: event.target.value })} /></Field><Field label="Nội dung thuyết minh / TTS"><textarea rows={7} value={content.text} onChange={event => updateContent({ text: event.target.value })} /></Field><small>{content.is_edited ? 'Đã biên tập thủ công' : 'Chưa chỉnh sửa thủ công'} · {dateLabel(content.updated_at)}</small><Field label="URL audio (HTTPS)"><input type="url" value={content.audio_url} onChange={event => updateContent({ audio_url: event.target.value, audio_sha256: '' })} placeholder="https://.../audio.mp3" /></Field>{content.audio_url.startsWith('https://') && <audio controls preload="none" src={content.audio_url} onError={() => setMessage('Không phát được audio. Kiểm tra URL và quyền truy cập tệp.')} />}<small>SHA-256: {content.audio_sha256 || 'Chưa xác minh — cần backend tính từ tệp audio.'}</small><button className="secondary-button" type="button" disabled={!can('audio.write')} onClick={queueAudio}>Tạo tác vụ audio demo</button></div>}
    {tab === 'Hình ảnh' && <div className="admin-form"><Field label="Thêm nhiều ảnh (tối đa 350 KB/ảnh)"><input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={imageBusy} onChange={event => { void addImages(event.target.files); event.target.value = '' }} /></Field><div className="admin-image-grid">{draft.images.map((image, index) => <figure key={`${index}-${image.slice(-16)}`}><img src={image} alt={`Ảnh POI ${index + 1}`} /><button className="text-button" type="button" onClick={() => setDraft({ ...draft, images: draft.images.filter((_, position) => position !== index) })}>Xóa ảnh {index + 1}</button></figure>)}</div>{!draft.images.length && <Empty text="Chưa có hình ảnh." />}</div>}
    {tab === 'QR' && <div className="admin-form"><Field label="Mã QR duy nhất"><input required value={draft.qr_code} onChange={event => setDraft({ ...draft, qr_code: event.target.value.trim() })} /></Field><Notice>Đây là mã định danh QR theo sơ đồ. URL đích và xuất ảnh QR cần thống nhất deep link với ứng dụng du khách; không tạo QR giả.</Notice><button className="secondary-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(draft.qr_code); setMessage('Đã sao chép mã QR.') } catch { setMessage('Không truy cập được clipboard. Bạn có thể chọn và sao chép mã trong ô nhập.') } }}>Sao chép mã</button></div>}
    {tab === 'Nhật ký' && (can('audit.read') ? <div>{data.audit.filter(log => log.target_id === draft.id).map(log => <details className="audit-entry" key={log.id}><summary>{log.action} · {dateLabel(log.created_at)}</summary><pre>{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre></details>)}{!data.audit.some(log => log.target_id === draft.id) && <Empty text="Chưa có thay đổi đã lưu." />}</div> : <Empty text="Vai trò hiện tại không có quyền xem nhật ký." />)}
    </form></>
}

export function Zones() {
  const { data } = useAdmin()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const rows = data.zones.filter(zone => zone.name.toLowerCase().includes(query.toLowerCase()) && (!status || zone.is_active === (status === 'active')))
  return <><Heading title="Khu vực" detail="Ranh giới bounding box và mức zoom theo sơ đồ dữ liệu."><button className="primary-button" onClick={() => navigate('/zones/new')}>+ Tạo khu vực</button></Heading><div className="filter-row"><input className="select-control" aria-label="Tìm khu vực" placeholder="Tìm khu vực..." value={query} onChange={event => setQuery(event.target.value)} /><select className="select-control" aria-label="Trạng thái khu vực" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></div><div className="zone-grid">{rows.map(zone => <section className="panel" key={zone.id}><div className="card-header"><h2>{zone.name}</h2><Status value={zone.is_active ? 'active' : 'inactive'} /></div><p>{data.pois.filter(poi => poi.zone_id === zone.id).length} POI · Zoom {zone.min_zoom}–{zone.max_zoom}</p><p className="page-subtitle">Vĩ độ {zone.min_lat} → {zone.max_lat}<br />Kinh độ {zone.min_lng} → {zone.max_lng}</p><button className="text-button" onClick={() => navigate(`/zones/${zone.id}/edit`)}>Chỉnh sửa khu vực →</button></section>)}</div>{!rows.length && <Empty />}<Notice>Offline Pack chưa có mô hình phiên bản/build trong sơ đồ. Bản này không mô phỏng publish thành công khi chưa có dịch vụ thật.</Notice></>
}

export function ZoneEditor({ id }: { id: string }) {
  const { data, commit } = useAdmin()
  const navigate = useNavigate()
  const original = data.zones.find(zone => zone.id === id)
  const [draft, setDraft] = useState<Zone>(() => original ? { ...original } : { id: uid(), name: '', min_lat: 20.95, max_lat: 21.1, min_lng: 105.75, max_lng: 105.95, min_zoom: 10, max_zoom: 18, is_active: true })
  const [message, setMessage] = useState('')
  if (id !== 'new' && !original) return <Empty text="Không tìm thấy khu vực." />
  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft.name.trim() || draft.min_lat >= draft.max_lat || draft.min_lng >= draft.max_lng || draft.min_zoom > draft.max_zoom) { setMessage('Tên không được trống; tọa độ min phải nhỏ hơn max; zoom min không vượt zoom max.'); return }
    const children = data.pois.filter(poi => poi.zone_id === draft.id)
    if (!draft.is_active && children.some(poi => poi.status === 'active')) { setMessage('Hãy ngừng hoạt động các POI thuộc khu vực trước khi tắt khu vực.'); return }
    if (children.some(poi => poi.latitude < draft.min_lat || poi.latitude > draft.max_lat || poi.longitude < draft.min_lng || poi.longitude > draft.max_lng)) { setMessage('Ranh giới mới phải bao gồm các POI đang thuộc khu vực.'); return }
    const next = { ...draft, name: draft.name.trim() }
    if (commit('zone.write', original ? 'zone.update' : 'zone.create', next.id, original ?? null, next, current => ({ ...current, zones: original ? current.zones.map(zone => zone.id === next.id ? next : zone) : [...current.zones, next] }))) navigate('/zones')
  }
  return <><Heading title={original ? `Sửa ${original.name}` : 'Tạo khu vực'} detail="Tọa độ WGS84 · Khung chữ nhật, không phải polygon."><button className="secondary-button" onClick={() => navigate('/zones')}>Hủy</button><button className="primary-button" form="zone-editor">Lưu khu vực</button></Heading>{message && <Notice>{message}</Notice>}<form id="zone-editor" className="panel admin-form" onSubmit={save}><Field label="Tên khu vực"><input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><div className="form-grid">{([['min_lat', 'Vĩ độ nhỏ nhất', -90, 90], ['max_lat', 'Vĩ độ lớn nhất', -90, 90], ['min_lng', 'Kinh độ nhỏ nhất', -180, 180], ['max_lng', 'Kinh độ lớn nhất', -180, 180], ['min_zoom', 'Zoom nhỏ nhất', 0, 22], ['max_zoom', 'Zoom lớn nhất', 0, 22]] as const).map(([key, label, min, max]) => <Field key={key} label={label}><input type="number" required min={min} max={max} step={key.includes('zoom') ? 1 : 'any'} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.valueAsNumber })} /></Field>)}</div><label className="admin-check"><input type="checkbox" checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} />Đang hoạt động</label><div className="admin-bounds"><span>Bắc {draft.max_lat}°</span><div><span>Tây {draft.min_lng}°</span><strong>Bounding box<br /><small>Sơ đồ minh họa, không phải bản đồ nền</small></strong><span>Đông {draft.max_lng}°</span></div><span>Nam {draft.min_lat}°</span></div></form></>
}

export function Settings() {
  const { data, commit } = useAdmin()
  const [radius, setRadius] = useState(data.defaultRadius)
  const [message, setMessage] = useState('')
  return <><Heading title="Cấu hình" detail="Thiết lập tiện ích của bản demo; không phải bảng cấu hình trong sơ đồ." /><form className="panel admin-form" onSubmit={event => { event.preventDefault(); if (commit('poi.write', 'settings.radius.update', 'default-radius', data.defaultRadius, radius, current => ({ ...current, defaultRadius: radius }))) setMessage('Đã lưu bán kính mặc định cho POI mới.') }}><Field label="Bán kính mặc định cho POI mới (m)"><input required type="number" min="1" step="1" value={radius} onChange={event => setRadius(event.target.valueAsNumber)} /></Field><Notice>Chỉ áp dụng khi tạo POI mới. Không tự động ghi đè bán kính các POI đã tồn tại.</Notice><button className="primary-button">Lưu cấu hình</button>{message && <Notice>{message}</Notice>}</form></>
}
