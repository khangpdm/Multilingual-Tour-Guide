import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../admin/api'
import { dateLabel, useAdmin } from '../../admin/store'
import type { Poi } from '../../admin/types'
import { Empty, Notice } from '../../shared/ui'

type Version = { content_version: number; document: Poi; saved_by: string; created_at: string }

export function PoiHistory({ poi }: { poi: Poi }) {
  const { can, mutate, busy, mode } = useAdmin()
  const [items, setItems] = useState<Version[]>([])
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
      toast.success('Đã khôi phục thành phiên bản mới.')
    } catch (reason) { toast.error((reason as Error).message) }
  }
  return <div className="admin-form">
    <Notice>Phiên bản hiện tại: {poi.content_version}. So sánh nội dung trước khi khôi phục. Nếu bản cũ không còn hợp lệ theo PRD, hệ thống từ chối khôi phục.</Notice>
    {error && <Notice>{error}</Notice>}
    {items.map(item => <details key={item.content_version} className="audit-entry"><summary>Phiên bản {item.content_version} · {dateLabel(item.created_at)}</summary>
      <pre>{JSON.stringify({ current: poi, previous: item.document }, null, 2)}</pre>
      {mode === 'live' && can('poi.edit') && poi.status !== 'archived' && <button className="secondary-button" disabled={busy} onClick={() => void restore(item.content_version)}>Khôi phục nội dung này</button>}
    </details>)}
    {!items.length && !error && <Empty text="Chưa có phiên bản cũ." />}
    <div className="admin-actions"><button className="secondary-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} · {total} phiên bản</span><button className="secondary-button" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Sau</button></div>
  </div>
}
