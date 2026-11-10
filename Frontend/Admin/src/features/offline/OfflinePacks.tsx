import { toast } from 'sonner'
import { useEffect, useState, type FormEvent } from 'react'
import { api, listAll } from '../../admin/api'
import { dateLabel, poiName, useAdmin } from '../../admin/store'
import type { OfflineRelease } from '../../admin/types'
import { downloadApi, Empty, Field, Heading, Notice, usePagination } from '../../shared/ui'
import { publicationIssues } from '../places/PoiReview'

const statusLabels: Record<string, string> = { building: 'Đang đóng gói', ready: 'Sẵn sàng', published: 'Đang phát hành', superseded: 'Đã thay thế / thu hồi', failed: 'Thất bại' }
const sizeLabel = (size: number | null) => size == null ? '—' : `${(size / 1024 / 1024).toFixed(2)} MB`

export function OfflinePacks() {
  const { data, can, mode } = useAdmin()
  const [releases, setReleases] = useState<OfflineRelease[]>([])
  const [zoneId, setZoneId] = useState('')
  const [locales, setLocales] = useState<string[]>(['vi'])

  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [refresh, setRefresh] = useState(0)
  const pagination = usePagination(releases.filter(item => !filter || item.status === filter))
  const selected = data.pois.filter(poi => poi.zone_id === zoneId && poi.status === 'published')
  const problems = selected.flatMap(poi => publicationIssues(poi, locales).map(issue => `${poiName(poi)}: ${issue}`))
  useEffect(() => {
    if (mode !== 'live') { setLoading(false); return }
    let closed = false
    let pending = false
    async function load() {
      if (pending) return
      pending = true
      try { const items = await listAll<OfflineRelease>('/admin/offline-packs'); if (!closed) { setReleases(items); setLoadError('') } }
      catch (error) { if (!closed) setLoadError((error as Error).message) }
      finally { pending = false; if (!closed) setLoading(false) }
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => { closed = true; window.clearInterval(timer) }
  }, [mode, refresh])
  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await api<OfflineRelease>('/admin/offline-packs', { method: 'POST', body: JSON.stringify({ zone_id: zoneId, locales }) })
      toast.success(`Đã tạo phiên bản ${result.version}. Đang đóng gói dữ liệu và tài nguyên thật.`)
      setRefresh(value => value + 1)
    } catch (error) { toast.error((error as Error).message) } finally { setBusy(false) }
  }
  async function change(release: OfflineRelease, action: 'publish' | 'withdraw') {
    if (!window.confirm(action === 'publish' ? 'Phát hành phiên bản này và thay thế phiên bản hiện hành của khu vực?' : 'Thu hồi bản phát hành? Các file đã tải xuống trước đó không thể xóa từ xa.')) return
    setBusy(true)
    try {
      await api(`/admin/offline-packs/${release.id}/${action}`, { method: 'POST' })
      toast.success(action === 'publish' ? 'Đã phát hành. Phiên bản trước được chuyển sang đã thay thế.' : 'Đã thu hồi bản phát hành.')
      setRefresh(value => value + 1)
    } catch (error) { toast.error((error as Error).message) } finally { setBusy(false) }
  }
  async function download(path: string, name: string) {
    try { await downloadApi(path, name) } catch (error) { toast.error((error as Error).message) }
  }
  return <>
    <Heading title="Gói offline" detail="Đóng gói nội dung đã công khai theo khu vực và ngôn ngữ. Phiên bản là snapshot bất biến."><button className="secondary-button" onClick={() => setRefresh(value => value + 1)}>Tải lại</button></Heading>
    
    {loadError && <Notice>{loadError}</Notice>}
    {mode !== 'live' && <Notice>Gói offline chỉ hoạt động khi kết nối API và database thật.</Notice>}
    {can('offline.manage') && <form className="panel admin-form" onSubmit={create}><h2>Tạo phiên bản mới</h2><fieldset disabled={busy || mode !== 'live'}>
      <Field label="Khu vực"><select required value={zoneId} onChange={event => setZoneId(event.target.value)}><option value="">Chọn khu vực đang bật</option>{data.zones.filter(zone => zone.is_active).map(zone => <option key={zone.zone_id} value={zone.zone_id}>{zone.name}</option>)}</select></Field>
      <div className="admin-actions">{data.languages.filter(language => language.is_active).map(language => <label className="admin-check" key={language.code}><input type="checkbox" checked={locales.includes(language.code)} onChange={event => setLocales(event.target.checked ? [...locales, language.code] : locales.filter(value => value !== language.code))} />{language.native_name}</label>)}</div>
      <p>{selected.length} địa điểm đang công khai · {locales.length} ngôn ngữ. Gói chung chứa ảnh và thông tin POI; mỗi gói ngôn ngữ chứa nội dung và MP3.</p>
      {problems.length > 0 && <details className="offline-problems"><summary>{problems.length} mục cần hoàn thiện trước khi đóng gói</summary><ul>{problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul></details>}
      <button className="primary-button" disabled={!zoneId || !locales.length || !selected.length || problems.length > 0 || busy}>Tạo gói offline</button>
    </fieldset><small>Chỉ đóng gói tài nguyên được tải lên Admin. Giới hạn 250 MB mỗi phần. Nội dung thay đổi sau khi tạo thì phải tạo phiên bản mới trước khi phát hành.</small></form>}
    <section className="panel"><div className="filter-row"><h2>Phiên bản và phát hành</h2><select className="select-control" aria-label="Lọc trạng thái gói" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {loading ? <Empty text="Đang tải phiên bản…" /> : <div className="offline-release-list">{pagination.rows.map(release => <article className="offline-release" key={release.id}>
        <header><div><h3>{data.zones.find(zone => zone.zone_id === release.zone_id)?.name || release.zone_id} · v{release.version}</h3><small>{release.poi_count} POI · Tạo {dateLabel(release.created_at)}</small></div><span className={`offline-status offline-${release.status}`}>{statusLabels[release.status]}</span></header>
        {release.error && <p className="admin-error" role="alert">{release.error}</p>}
        <div className="offline-parts"><div><strong>Dữ liệu chung</strong><span>{sizeLabel(release.common_size_bytes)}</span>{release.common_file_url && release.status !== 'failed' && <button className="text-button" onClick={() => void download(release.common_file_url!, `${release.id}-common.zip`)}>Tải ZIP</button>}</div>{release.languages.map(part => <div key={part.language_code}><strong>{part.language_code.toUpperCase()}</strong><span>{sizeLabel(part.size_bytes)}</span><small>{statusLabels[part.status] || part.status}</small>{part.file_url && !['failed', 'building'].includes(release.status) && <button className="text-button" onClick={() => void download(part.file_url!, `${release.id}-${part.language_code}.zip`)}>Tải ZIP</button>}</div>)}</div>
        <details><summary>Mã kiểm tra SHA-256</summary><p className="checksum">Chung: {release.common_sha256 || 'Chưa có'}</p>{release.languages.map(part => <p className="checksum" key={part.language_code}>{part.language_code}: {part.sha256 || 'Chưa có'}</p>)}</details>
        <div className="admin-actions">{can('offline.publish') && release.status === 'ready' && <button disabled={busy} className="primary-button" onClick={() => void change(release, 'publish')}>Phát hành phiên bản</button>}{can('offline.publish') && release.status === 'published' && <button disabled={busy} className="danger-button" onClick={() => void change(release, 'withdraw')}>Thu hồi</button>}{release.published_at && <small>Phát hành: {dateLabel(release.published_at)}</small>}</div>
      </article>)}</div>}
      {!loading && !pagination.rows.length && <Empty text="Chưa có phiên bản. Chọn khu vực và ngôn ngữ để tạo gói đầu tiên." />}{pagination.controls}
    </section>
  </>
}
