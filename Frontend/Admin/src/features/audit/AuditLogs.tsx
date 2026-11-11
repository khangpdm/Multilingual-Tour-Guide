import { toast } from 'sonner'
import { useState, type FormEvent } from 'react'
import { activeTask, dateLabel, enqueue, poiName, stamp, uid, useAdmin } from '../../admin/store'
import { permissionGroups, type Account, type AudioTask, type Audit, type Language, type Permission, type Role } from '../../admin/types'
import { api } from '../../admin/api'
import { CrudDialog, downloadApi, downloadCsv, Empty, Field, Heading, saveBlob, Status, usePagination } from '../../shared/ui'

export function AuditLogs() {
  const { data, mode, can } = useAdmin()
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [target, setTarget] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [format, setFormat] = useState('csv')
  const [remote, setRemote] = useState<Audit[] | null>(null)

  const [pending, setPending] = useState(false)
  function params() { const query = new URLSearchParams(); if (actor) query.set('actor', actor); if (action) query.set('action', action); if (target) query.set('target_id', target); if (from) query.set('from', new Date(`${from}T00:00:00+07:00`).toISOString()); if (to) query.set('to', new Date(`${to}T23:59:59.999+07:00`).toISOString()); return query }
  const rows = (mode === 'live' ? remote ?? data.audit : data.audit.filter(log => (!actor || log.actor_user_id === actor) && (!action || log.action === action) && (!target || log.target_id === target) && (!from || new Date(log.timestamp) >= new Date(`${from}T00:00:00+07:00`)) && (!to || new Date(log.timestamp) <= new Date(`${to}T23:59:59.999+07:00`)))).slice().sort((first, second) => second.timestamp.localeCompare(first.timestamp))
  const pagination = usePagination(rows)
  async function search(event: FormEvent) {
    event.preventDefault(); if (from && to && from > to) { toast.error('Ngày bắt đầu phải trước ngày kết thúc.'); return }
    setPending(true)
    try { if (mode === 'live') { const items: Audit[] = []; const query = params(); query.set('page_size', '100'); for (let page = 1; ; page++) { query.set('page', String(page)); const result = await api<{ items: Audit[]; total: number }>(`/admin/audit-logs?${query}`); items.push(...result.items); if (items.length >= result.total || !result.items.length) break } setRemote(items) } } catch (error) { toast.error((error as Error).message) } finally { setPending(false) }
  }
  async function exportLogs() {
    if (from && to && from > to) { toast.error('Khoảng ngày không hợp lệ.'); return }
    setPending(true)
    try {
      if (rows.length > 100000) throw new Error('Tối đa 100.000 dòng. Hãy thu hẹp khoảng thời gian.')
      if (mode === 'live') { const query = params(); query.set('format', format); await downloadApi(`/admin/audit-logs/export?${query}`, `audit-logs.${format}`) }
      else if (format === 'json') saveBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), 'demo-audit-logs.json')
      else downloadCsv('demo-audit-logs.csv', [['timestamp', 'actor_user_id', 'action', 'target_id', 'before', 'after'], ...rows.map(log => [log.timestamp, log.actor_user_id, log.action, log.target_id, JSON.stringify(log.before), JSON.stringify(log.after)])])
    } catch (error) { toast.error((error as Error).message) } finally { setPending(false) }
  }
  return <><Heading title="Nhật ký thao tác" detail="Chỉ đọc. UTC+7; mặc định API trả 30 ngày gần nhất. Không chứa mật khẩu, token hoặc PII.">{can('audit.export') && <><select className="select-control" aria-label="Định dạng xuất" value={format} onChange={event => setFormat(event.target.value)}><option value="csv">CSV</option><option value="json">JSON</option></select><button className="secondary-button" disabled={pending} onClick={() => void exportLogs()}>Xuất nhật ký</button></>}</Heading><section className="panel"><form className="filter-row" onSubmit={search}><input className="select-control" aria-label="Người thực hiện" placeholder="User ID" value={actor} onChange={event => setActor(event.target.value)} /><input className="select-control" aria-label="Hành động" placeholder="Ví dụ: poi.update" value={action} onChange={event => setAction(event.target.value)} /><input className="select-control" aria-label="Đối tượng" placeholder="Target ID" value={target} onChange={event => setTarget(event.target.value)} /><Field label="Từ ngày"><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field><Field label="Đến ngày"><input type="date" min={from} value={to} onChange={event => setTo(event.target.value)} /></Field><button className="primary-button" disabled={pending}>Áp dụng</button></form>{pagination.rows.map(log => <details className="audit-entry" key={log.log_id}><summary><strong>{log.action}</strong><span>{log.actor_email || log.actor_user_id}</span><time>{dateLabel(log.timestamp)}</time></summary><p>{log.target_id}</p><div className="admin-diff"><div><h3>Trước</h3><pre>{JSON.stringify(log.before, null, 2)}</pre></div><div><h3>Sau</h3><pre>{JSON.stringify(log.after, null, 2)}</pre></div></div></details>)}{!rows.length && <Empty />}{pagination.controls}</section></>
}
