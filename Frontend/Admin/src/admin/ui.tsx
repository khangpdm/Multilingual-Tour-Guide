import { useEffect, useRef, useState, type ReactNode } from 'react'
import { apiBase, useAdmin } from './store'

export function Heading({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">MULTILINGUAL TOUR GUIDE / QUẢN TRỊ</p><h1>{title}</h1><p className="page-subtitle">{detail}</p></div><div className="heading-actions">{children}</div></div> }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
const statusNames: Record<string, string> = { published: 'Công khai', unpublished: 'Đã gỡ công khai', archived: 'Đã lưu trữ', active: 'Hoạt động', deactivated: 'Vô hiệu hóa', pending_activation: 'Chờ kích hoạt', queued: 'Chờ xử lý', processing: 'Đang xử lý', completed: 'Hoàn tất', failed: 'Thất bại', cancelled: 'Đã hủy', inactive: 'Đã tắt', ready: 'Sẵn sàng', pending: 'Đang xử lý', missing: 'Chưa có', low: 'Thấp', medium: 'Trung bình', high: 'Cao', unknown: 'Chưa đủ dữ liệu' }
export function Status({ value }: { value: string }) { return <span className={`status-badge badge-${['failed', 'deactivated', 'unpublished', 'inactive', 'high'].includes(value) ? 'danger' : ['queued', 'processing', 'pending_activation', 'pending', 'medium'].includes(value) ? 'warn' : ['archived', 'cancelled', 'missing', 'unknown'].includes(value) ? 'neutral' : 'ready'}`}><i />{statusNames[value] || value}</span> }
export function Notice({ children }: { children: ReactNode }) { return <p className="admin-notice" role="status">{children}</p> }
export function Empty({ text = 'Không có dữ liệu phù hợp.' }: { text?: string }) { return <div className="empty-note">{text}</div> }
export function CrudDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => previous?.focus() }, [])
  return <dialog ref={dialog} className="crud-dialog native-dialog" onCancel={event => { event.preventDefault(); onClose() }} aria-label={title}><div className="crud-dialog-head"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Đóng biểu mẫu" onClick={onClose}>×</button></div>{children}</dialog>
}
export function DemoNotice() { const { error, mode, busy, streamStatus, can } = useAdmin(); return <>{mode === 'live' && can('audio.view_tasks') && <small className="admin-block" role="status">Audio: {streamStatus}</small>}{busy && <Notice>Đang đồng bộ dữ liệu…</Notice>}{error && <p className="admin-error" role="alert">{error}</p>}</> }
export function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, totalPages)
  return { rows: items.slice((current - 1) * pageSize, current * pageSize), controls: <div className="pagination"><span>{items.length} kết quả</span><select aria-label="Số dòng mỗi trang" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}>{[20, 50, 100].map(size => <option key={size} value={size}>{size} dòng</option>)}</select><button className="secondary-button" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</button><span>{current}/{totalPages}</span><button className="secondary-button" disabled={current === totalPages} onClick={() => setPage(current + 1)}>Sau</button></div> }
}
export function saveBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const quote = (value: string | number) => `"${String(value).replace(/^[=+@\-\t\r]/, match => `'${match}`).replaceAll('"', '""')}"`
  saveBlob(new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename)
}
export async function downloadApi(path: string, filename: string) {
  let response = await fetch(`${apiBase}${path}`, { credentials: 'include' })
  if (response.status === 401) { const refresh = await fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' }); if (refresh.ok) response = await fetch(`${apiBase}${path}`, { credentials: 'include' }) }
  if (!response.ok) { if (response.status === 401) window.dispatchEvent(new Event('admin-session-expired')); const body = await response.json().catch(() => null); throw new Error(body?.error?.message || `Không tải được báo cáo (HTTP ${response.status}).`) }
  saveBlob(await response.blob(), filename)
}
const fieldNames: Record<string, string> = {
  poi_id: 'POI ID', name: 'Tên địa điểm', value: 'Số lượt', metric: 'Chỉ số',
  missing_locales: 'Ngôn ngữ còn thiếu', type: 'Loại thiếu', qr_scans: 'Lượt quét QR',
  total_plays: 'Tổng lượt nghe', qr_plays: 'Lượt nghe từ QR', qr_rate_percentage: 'Tỷ lệ QR (%)',
  locale: 'Ngôn ngữ', devices: 'Thiết bị', percentage: 'Tỷ lệ (%)', total_devices: 'Tổng thiết bị',
  days: 'Số ngày', offline_pack_downloaded: 'Thiết bị tải gói', adoption_rate_percentage: 'Tỷ lệ tải gói (%)',
  tier1_hit_rate: 'Audio có sẵn (%)', tier1_5_rate: 'Tạo theo yêu cầu (%)', tier2_rate: 'Cloud TTS (%)',
  tier3_offline_fallback_rate: 'TTS trên thiết bị (%)', pois_checked: 'POI đã kiểm tra', pois_with_gaps: 'POI còn thiếu',
  bucket_start: 'Mốc thời gian (UTC+7)', visit_count: 'Lượt ghé', lat: 'Vĩ độ', lng: 'Kinh độ', level: 'Mức độ',
}
export const fieldLabel = (key: string) => fieldNames[key] || key
export function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const pagination = usePagination(rows)
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))]
  if (!rows.length) return <Empty />
  const display = (column: string, value: unknown): ReactNode => {
    if (value === null || value === undefined) return '—'
    if (column === 'level') return <Status value={String(value)} />
    if (column === 'bucket_start') return new Date(String(value)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    if (value === 'missing_translation') return 'Thiếu bản dịch'
    if (value === 'missing_pregen_audio') return 'Thiếu audio'
    if (Array.isArray(value)) return value.join(', ')
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
  return <><div className="table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{fieldLabel(column)}</th>)}</tr></thead><tbody>{pagination.rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{display(column, row[column])}</td>)}</tr>)}</tbody></table></div>{pagination.controls}</>
}
