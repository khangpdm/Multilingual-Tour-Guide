import { AuditEntry } from '../audit/AuditEntry'
import { toast } from 'sonner'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../admin/api'
import { dateLabel, emptyContent, poiName, stamp, uid, useAdmin } from '../../admin/store'
import type { Poi } from '../../admin/types'
import { ContentFields, PoiContentEditor } from './PoiContent'
import { PoiImages, PoiQr } from './PoiMedia'
import { categories, PoiReview } from './PoiReview'
import { PoiHistory } from './PoiHistory'
import { PoiLocationPicker } from './PoiLocationPicker'
import { locationInZone, validLocation } from './location'
import { Empty, Field, Heading, Notice, Status, usePagination } from '../../shared/ui'

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
  const rows = data.pois.filter(poi => Object.values(poi.content).some(content => content.name.toLowerCase().includes(query.toLowerCase())) && (!zone || poi.zone_id === zone) && (!status || poi.status === status) && (!category || poi.category === category) && (!missing || !poi.content.en?.audio_url)).sort((first, second) => sort === 'name_asc' ? poiName(first).localeCompare(poiName(second)) : sort === 'created_at_desc' ? second.created_at.localeCompare(first.created_at) : second.updated_at.localeCompare(first.updated_at))
  const pagination = usePagination(rows)
  return <>
    <Heading title="Địa điểm (POI)" detail="Nội dung tiếng Anh bắt buộc; thay đổi có hiệu lực ngay sau khi lưu.">{can('poi.create') && <button className="primary-button" onClick={() => navigate('/pois/new')}>+ Tạo POI</button>}</Heading>
    <section className="panel">
      <div className="filter-row">
        <input className="select-control" aria-label="Tìm POI" placeholder="Tìm tên địa điểm…" value={query} onChange={event => setQuery(event.target.value)} />
        <select className="select-control" aria-label="Khu vực" value={zone} onChange={event => setZone(event.target.value)}><option value="">Tất cả khu vực</option>{data.zones.map(item => <option key={item.zone_id} value={item.zone_id}>{item.name}</option>)}</select>
        <select className="select-control" aria-label="Trạng thái" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="archived">Đã lưu trữ</option></select>
        <select className="select-control" aria-label="Danh mục" value={category} onChange={event => setCategory(event.target.value)}><option value="">Tất cả danh mục</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className="select-control" aria-label="Sắp xếp" value={sort} onChange={event => setSort(event.target.value)}><option value="updated_at_desc">Mới cập nhật</option><option value="name_asc">Tên A–Z</option><option value="created_at_desc">Mới tạo</option></select>
        <label className="admin-check"><input type="checkbox" checked={missing} onChange={event => setMissing(event.target.checked)} />Thiếu audio mặc định</label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Địa điểm</th><th>Khu vực</th><th>Nội dung / audio</th><th>Trạng thái</th><th>Cập nhật</th><th /></tr></thead><tbody>{pagination.rows.map(poi => <tr key={poi.poi_id}>
        <td><strong>{poiName(poi)}</strong><small className="admin-block">{categories[poi.category] || poi.category} · v{poi.content_version}</small></td>
        <td>{data.zones.find(item => item.zone_id === poi.zone_id)?.name}</td>
        <td>{data.languages.filter(language => language.is_active).map(language => <div key={language.code} className="locale-status">{language.code.toUpperCase()} <Status value={poi.content_status?.[language.code] || (poi.content[language.code]?.audio_url ? 'ready' : 'missing')} /></div>)}{!poi.content.en?.audio_url && <small>Chưa có audio mặc định tiếng Anh</small>}</td>
        <td><Status value={poi.status} /></td><td>{dateLabel(poi.updated_at)}</td><td><button className="text-button" onClick={() => navigate(`/pois/${poi.poi_id}`)}>Chi tiết →</button></td>
      </tr>)}</tbody></table></div>{pagination.controls}
      {!rows.length && <Empty text="Không có địa điểm phù hợp." />}
    </section>
  </>
}

export function PoiEditor({ id }: { id: string }) {
  const { data, can, mutate, user, busy, mode } = useAdmin()
  const navigate = useNavigate()
  const original = data.pois.find(poi => poi.poi_id === id)
  const [draft, setDraft] = useState<Poi>(() => original ? structuredClone(original) : { poi_id: uid('poi'), zone_id: data.zones.find(zone => zone.is_active)?.zone_id || '', category: 'heritage', location: { lat: 10.7726, lng: 106.698 }, geofence_radius_m: 30, priority: 0, content_version: 1, qr_code: null, status: 'active', images: [], content: { en: emptyContent() }, last_modified_by: user!.user_id, created_at: stamp(), updated_at: stamp() })
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState('Thông tin')
  useEffect(() => { if (original && !dirty) setDraft(structuredClone(original)) }, [original, dirty])
  useEffect(() => {
    if (original || mode !== 'live') return
    let cancelled = false
    void api<{ radius_m: number }>('/admin/settings/geofence').then(result => { if (!cancelled) setDraft(current => ({ ...current, geofence_radius_m: result.radius_m })) }).catch(error => toast.error((error as Error).message))
    return () => { cancelled = true }
  }, [original, mode])
  const editable = can(original ? 'poi.edit' : 'poi.create') && original?.status !== 'archived'
  if (id !== 'new' && !original) return <Empty text="Không tìm thấy POI." />
  if (id === 'new' && !can('poi.create')) return <Empty text="Bạn không có quyền tạo POI." />
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      const content = draft.content.en
      if (!validLocation(draft.location)) throw new Error('Vui lòng chọn vị trí hợp lệ trên bản đồ.')
      const zone = data.zones.find(item => item.zone_id === draft.zone_id)
      if (zone && !locationInZone(draft.location, zone)) throw new Error('Vị trí nằm ngoài khu vực đã chọn. Hãy chọn lại trên bản đồ hoặc đổi khu vực.')
      if (!original && (!content?.name.trim() || !content.text.trim())) throw new Error('Cần tên và kịch bản tiếng Anh.')
      const body = { category: draft.category, zone_id: draft.zone_id, location: draft.location, priority: draft.priority || 0, ...(!original ? { content: { en: { name: content.name.trim(), address: content.address || null, description: content.description || null, introduction: content.introduction || null, text: content.text.trim() } } } : {}) }
      const result = await mutate<{ poi: Poi }>({ permission: original ? 'poi.edit' : 'poi.create', path: original ? `/admin/pois/${id}` : '/admin/pois', method: original ? 'PUT' : 'POST', version: draft.content_version, body, action: original ? 'poi.update' : 'poi.create', target: draft.poi_id, demo: current => ({ ...current, pois: original ? current.pois.map(poi => poi.poi_id === id ? { ...draft, content_version: poi.content_version + 1, updated_at: stamp() } : poi) : [...current.pois, { ...draft, qr_code: crypto.randomUUID().replaceAll('-', '') }] }) })
      setDirty(false)
      toast.success('Đã lưu POI. Nội dung có hiệu lực ngay; kiểm tra trạng thái audio tiếng Anh.')
      if (!original) navigate(`/pois/${result?.poi.poi_id || draft.poi_id}`, { replace: true })
    } catch (error) { toast.error((error as Error).message) }
  }
  async function changeStatus() {
    if (!original) return
    const restoring = original.status === 'archived'
    if (!window.confirm(restoring ? 'Khôi phục POI và giữ nguyên mã QR?' : 'Lưu trữ POI? QR sẽ ngừng có hiệu lực cho đến khi khôi phục.')) return
    try {
      await mutate({ permission: restoring ? 'content.restore' : 'poi.delete', path: `/admin/pois/${id}${restoring ? '/restore' : ''}`, method: restoring ? 'POST' : 'DELETE', version: original.content_version, action: restoring ? 'poi.restore' : 'poi.archive', target: id, demo: current => ({ ...current, pois: current.pois.map(poi => poi.poi_id === id ? { ...poi, status: restoring ? 'active' : 'archived', content_version: poi.content_version + 1 } : poi) }) })
      toast.success('Đã cập nhật trạng thái.')
    } catch (error) { toast.error((error as Error).message) }
  }
  return <>
    <Heading title={original ? poiName(original) : 'Tạo địa điểm'} detail="Lưu phiên bản mới, không qua bước duyệt hoặc công khai.">
      <button className="secondary-button" onClick={() => navigate('/pois')}>Về danh sách</button>
      {original && can(original.status === 'archived' ? 'content.restore' : 'poi.delete') && <button className="secondary-button" disabled={busy} onClick={() => void changeStatus()}>{original.status === 'archived' ? 'Khôi phục' : 'Lưu trữ'}</button>}
    </Heading>
    {original && <Notice><Status value={original.status} /> · Phiên bản {original.content_version}{dirty && draft.content_version !== original.content_version && ' · Có phiên bản mới trên máy chủ. Hãy so sánh trước khi lưu.'}</Notice>}
    {original && dirty && draft.content_version !== original.content_version && <Notice><details><summary>So sánh dữ liệu</summary><pre>{JSON.stringify({ local: draft, server: original }, null, 2)}</pre></details><button className="secondary-button" onClick={() => { if (window.confirm('Bỏ thay đổi chưa lưu và dùng bản mới?')) setDirty(false) }}>Dùng bản mới</button></Notice>}
    <section className="panel">
      <div className="tabs">{(original ? ['Thông tin', 'Nội dung & audio', 'Hình ảnh', 'QR', 'Kiểm tra & xem trước', 'Lịch sử phiên bản', 'Nhật ký'] : ['Thông tin']).map(name => <button key={name} className={tab === name ? 'tab-active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
      {tab === 'Thông tin' && <form className="admin-form" onSubmit={save} onChange={() => setDirty(true)}><fieldset disabled={!editable || busy}>
        <div className="form-grid">
          <Field label="Khu vực"><select required value={draft.zone_id} onChange={event => setDraft({ ...draft, zone_id: event.target.value })}><option value="">Chọn khu vực</option>{data.zones.filter(zone => zone.is_active || zone.zone_id === draft.zone_id).map(zone => <option key={zone.zone_id} value={zone.zone_id}>{zone.name}{!zone.is_active && ' (đã tắt)'}</option>)}</select></Field>
          <Field label="Danh mục"><select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Độ ưu tiên"><input required type="number" min={0} max={10000} value={draft.priority || 0} onChange={event => setDraft({ ...draft, priority: event.target.valueAsNumber })} /></Field>
          <Field label="Bán kính chung do Admin cấu hình"><input readOnly value={`${draft.geofence_radius_m} m`} /></Field>
        </div>
        <PoiLocationPicker value={draft.location} zone={data.zones.find(zone => zone.zone_id === draft.zone_id)} disabled={!editable || busy} onChange={location => { setDraft(current => ({ ...current, location })); setDirty(true) }} />
        {!original && <><h3>Nội dung tiếng Anh bắt buộc</h3><ContentFields value={draft.content.en} onChange={content => setDraft({ ...draft, content: { en: content } })} /><Notice>POI hoạt động ngay sau khi lưu. Hệ thống tự tạo tác vụ audio tiếng Anh; bạn có thể thay bằng MP3.</Notice></>}
        {editable && <button className="primary-button">Lưu thông tin</button>}
      </fieldset>{original && <small>Cập nhật: {dateLabel(original.updated_at)}</small>}</form>}
      {tab === 'Nội dung & audio' && original && <PoiContentEditor key={original.poi_id} poi={original} />}
      {tab === 'Hình ảnh' && original && <PoiImages poi={original} />}
      {tab === 'QR' && original && <PoiQr poi={original} />}
      {tab === 'Kiểm tra & xem trước' && original && <PoiReview poi={original} />}
      {tab === 'Lịch sử phiên bản' && original && <PoiHistory poi={original} />}
      {tab === 'Nhật ký' && (can('audit.view') ? <>{data.audit.filter(log => log.target_id === id).map(log => <AuditEntry key={log.log_id} log={log} />)}{!data.audit.some(log => log.target_id === id) && <Empty text="Chưa có nhật ký cho địa điểm này." />}</> : <Empty text="Bạn không có quyền xem nhật ký." />)}
    </section>
  </>
}
