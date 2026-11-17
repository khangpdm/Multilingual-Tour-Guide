import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { api, assetUrl } from '../../admin/api'
import { dateLabel, useAdmin } from '../../admin/store'
import type { Content, Data, Poi } from '../../admin/types'
import { CrudDialog, Empty, Notice } from '../../shared/ui'
import { categories } from './PoiReview'

type Version = { content_version: number; document: Poi; saved_by: string; created_at: string }

type ComparisonRow = { label: string; previous: ReactNode; current: ReactNode; changed: boolean }

function textValue(value?: string | null) {
  return value?.trim() ? value : 'Chưa có'
}

function AudioPreview({ content }: { content?: Content }) {
  if (!content?.audio_url) return <span className="history-empty">Chưa có audio</span>
  return <div className="history-audio"><span>{content.audio_source === 'UPLOADED' ? 'MP3 tải lên' : content.audio_source === 'TTS' ? 'Giọng đọc tự động' : 'Audio đã lưu'}</span><audio controls preload="none" src={assetUrl(content.audio_url)} /></div>
}

function ImagePreview({ poi }: { poi: Poi }) {
  if (!poi.images?.length) return <span className="history-empty">Chưa có hình ảnh</span>
  return <div className="history-images">{poi.images.map((image, index) => <figure key={`${image}-${index}`}><img src={assetUrl(image)} alt={`Ảnh ${index + 1}`} loading="lazy" /><figcaption>{image === poi.cover_image ? 'Ảnh đại diện' : `Ảnh ${index + 1}`}</figcaption></figure>)}</div>
}

function comparisonRows(previous: Poi, current: Poi, data: Data): ComparisonRow[] {
  const rows: ComparisonRow[] = []
  function addText(label: string, before: string, after: string) {
    rows.push({ label, previous: before, current: after, changed: before !== after })
  }
  const zoneName = (zoneId: string) => data.zones.find(zone => zone.zone_id === zoneId)?.name || 'Khu vực không còn trong danh sách'
  rows.push({ label: 'Khu vực', previous: zoneName(previous.zone_id), current: zoneName(current.zone_id), changed: previous.zone_id !== current.zone_id })
  addText('Danh mục', categories[previous.category] || previous.category, categories[current.category] || current.category)
  addText('Vĩ độ', String(previous.location.lat), String(current.location.lat))
  addText('Kinh độ', String(previous.location.lng), String(current.location.lng))
  addText('Độ ưu tiên', String(previous.priority ?? 0), String(current.priority ?? 0))
  rows.push({ label: 'Hình ảnh', previous: <ImagePreview poi={previous} />, current: <ImagePreview poi={current} />, changed: JSON.stringify([previous.images, previous.cover_image]) !== JSON.stringify([current.images, current.cover_image]) })
  const fields = [['name', 'Tên địa điểm'], ['address', 'Địa chỉ'], ['description', 'Mô tả ngắn'], ['introduction', 'Bài giới thiệu'], ['text', 'Kịch bản thuyết minh']] as const
  for (const locale of new Set([...Object.keys(previous.content), ...Object.keys(current.content)])) {
    const language = data.languages.find(item => item.code === locale)?.native_name || locale.toUpperCase()
    const before = previous.content[locale]
    const after = current.content[locale]
    for (const [field, label] of fields) addText(`${language} · ${label}`, textValue(before?.[field]), textValue(after?.[field]))
    rows.push({ label: `${language} · Audio`, previous: <AudioPreview content={before} />, current: <AudioPreview content={after} />, changed: (before?.audio_url ?? null) !== (after?.audio_url ?? null) || (before?.audio_sha256 ?? null) !== (after?.audio_sha256 ?? null) || (before?.audio_source ?? null) !== (after?.audio_source ?? null) })
  }
  return rows
}

function VersionComparison({ item, poi, data }: { item: Version; poi: Poi; data: Data }) {
  const [showAll, setShowAll] = useState(false)
  const rows = comparisonRows(item.document, poi, data)
  const changed = rows.filter(row => row.changed)
  const visible = showAll ? rows : changed
  return <div className="history-comparison">
    <div className="history-toolbar"><p>{changed.length ? `${changed.length} mục khác với phiên bản hiện tại.` : 'Nội dung có thể khôi phục giống phiên bản hiện tại.'}</p><label className="admin-check"><input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} />Hiện cả mục không thay đổi</label></div>
    {visible.length > 0 && <div className="history-table-scroll" role="region" aria-label={`So sánh phiên bản ${item.content_version}`} tabIndex={0}><table className="history-table"><caption>Đối chiếu bản đã lưu với nội dung hiện tại</caption><thead><tr><th scope="col">Nội dung</th><th scope="col">Bản đã lưu · Phiên bản {item.content_version}</th><th scope="col">Hiện tại · Phiên bản {poi.content_version}</th></tr></thead><tbody>{visible.map(row => <tr key={row.label} className={row.changed ? 'history-changed' : undefined}><th scope="row">{row.label}{row.changed && <span className="history-change-label">Đã thay đổi</span>}</th><td>{row.previous}</td><td>{row.current}</td></tr>)}</tbody></table></div>}
  </div>
}

export function PoiHistory({ poi }: { poi: Poi }) {
  const { can, mutate, busy, mode, data } = useAdmin()
  const [items, setItems] = useState<Version[]>([])
  const [selected, setSelected] = useState<Version | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    if (mode !== 'live') return
    void api<{ items: Version[]; total: number }>(`/admin/pois/${poi.poi_id}/versions?page=${page}&page_size=20`).then(result => { if (!cancelled) { setItems(result.items); setTotal(result.total); setError('') } }).catch(reason => { if (!cancelled) setError((reason as Error).message) })
    return () => { cancelled = true }
  }, [poi.poi_id, poi.content_version, page, mode])
  async function restore(version: number) {
    if (!window.confirm(`Khôi phục nội dung phiên bản ${version}? Mã QR và bán kính chung không thay đổi; bản hiện tại được giữ trong lịch sử.`)) return
    try {
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/versions/${version}/restore`, version: poi.content_version, action: 'poi.version_restore', target: poi.poi_id, demo: state => state })
      setSelected(null)
      toast.success('Đã khôi phục thành phiên bản mới.')
    } catch (reason) { toast.error((reason as Error).message) }
  }
  return <div className="admin-form">
    <Notice>Phiên bản hiện tại: {poi.content_version}. Chọn một bản đã lưu để xem nội dung khác nhau. Khôi phục sẽ tạo phiên bản mới và giữ bản hiện tại trong lịch sử. Mã QR, trạng thái hoạt động và bán kính chung không thay đổi.</Notice>
    {error && <Notice>{error}</Notice>}
    <div className="record-list">{items.map(item => <button type="button" key={item.content_version} className="record-row" aria-haspopup="dialog" onClick={() => setSelected(item)}><span className="record-row-title"><strong>Phiên bản {item.content_version}</strong><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></span><span className="record-row-action">Xem chi tiết →</span></button>)}</div>
    {!items.length && !error && <Empty text="Chưa có phiên bản cũ." />}
    <div className="admin-actions"><button className="secondary-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} · {total} phiên bản</span><button className="secondary-button" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Sau</button></div>
    {selected && <CrudDialog title={`Chi tiết phiên bản ${selected.content_version}`} size="wide" onClose={() => setSelected(null)}>
      <p className="admin-block">Đã lưu lúc {dateLabel(selected.created_at)} · So sánh với phiên bản hiện tại: {poi.content_version}</p>
      <VersionComparison item={selected} poi={poi} data={data} />
      <div className="record-dialog-actions"><button type="button" className="secondary-button" onClick={() => setSelected(null)}>Đóng</button>{mode === 'live' && can('poi.edit') && poi.status !== 'archived' && <button type="button" className="primary-button" disabled={busy} onClick={() => void restore(selected.content_version)}>Khôi phục phiên bản {selected.content_version}</button>}</div>
    </CrudDialog>}
  </div>
}
