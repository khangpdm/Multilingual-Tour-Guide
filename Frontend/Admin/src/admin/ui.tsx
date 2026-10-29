import type { ReactNode } from 'react'
import { useAdmin } from './store'

export function Heading({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">AUTO AUDIO GUIDE / QUẢN TRỊ</p><h1>{title}</h1><p className="page-subtitle">{detail}</p></div><div className="heading-actions">{children}</div></div> }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
export function Status({ value }: { value: string }) { return <span className={`status-badge badge-${['FAILED', 'DEACTIVATED', 'inactive'].includes(value) ? 'danger' : ['QUEUED', 'PROCESSING', 'PENDING_ACTIVATION'].includes(value) ? 'warn' : ['CANCELLED'].includes(value) ? 'neutral' : 'ready'}`}><i />{({ ACTIVE: 'Hoạt động', DEACTIVATED: 'Vô hiệu hóa', PENDING_ACTIVATION: 'Chờ kích hoạt', QUEUED: 'Chờ xử lý', PROCESSING: 'Đang xử lý', COMPLETED: 'Hoàn tất', FAILED: 'Thất bại', CANCELLED: 'Đã hủy', active: 'Hoạt động', inactive: 'Ngừng hoạt động' } as Record<string, string>)[value] || value}</span> }
export function Notice({ children }: { children: ReactNode }) { return <p className="admin-notice" role="status">{children}</p> }
export function Empty({ text = 'Không có dữ liệu phù hợp.' }: { text?: string }) { return <div className="empty-note">{text}</div> }
export function CrudDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="crud-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="crud-dialog" role="dialog" aria-modal="true" aria-labelledby="crud-dialog-title"><div className="crud-dialog-head"><h2 id="crud-dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Đóng biểu mẫu" onClick={onClose}>×</button></div>{children}</section></div> }
export function DemoNotice() { const { error } = useAdmin(); return <><div className="admin-demo">Chế độ demo · Lưu trên trình duyệt này · Chuyển vai trò chỉ để xem thử, không thay thế xác thực/phân quyền backend.</div>{error && <p className="admin-error" role="alert">{error}</p>}</> }
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const quote = (value: string | number) => `"${String(value).replace(/^[=+@\-\t\r]/, match => `'${match}`).replaceAll('"', '""')}"`
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
