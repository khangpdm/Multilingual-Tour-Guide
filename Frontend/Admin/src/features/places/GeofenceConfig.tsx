import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { api } from '../../admin/api'
import { useAdmin } from '../../admin/store'
import { Field, Notice } from '../../shared/ui'

export function GeofenceConfig() {
  const { mode, can, mutate, busy } = useAdmin()
  const [radius, setRadius] = useState(30)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    if (mode !== 'live') return
    void api<{ radius_m: number }>('/admin/settings/geofence').then(result => { if (!cancelled) { setRadius(result.radius_m); setLoaded(true) } }).catch(reason => { if (!cancelled) setError((reason as Error).message) })
    return () => { cancelled = true }
  }, [mode])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!window.confirm(`Áp dụng bán kính ${radius} m cho tất cả POI và tạo phiên bản mới cho POI bị thay đổi?`)) return
    try {
      await mutate({ permission: 'system.manage_constants', path: '/admin/settings/geofence', method: 'PUT', body: { radius_m: radius }, action: 'system.geofence_update', target: 'geofence_radius_m', demo: state => state })
      toast.success('Đã cập nhật bán kính chung. Gói offline cũ cần build lại.')
    } catch (reason) { toast.error((reason as Error).message) }
  }
  if (!can('system.manage_constants')) return null
  return <form className="panel admin-form" onSubmit={save}>
    <h3>Cấu hình geofence chung</h3>
    <Field label="Bán kính kích hoạt (10–200 m)"><input required type="number" min={10} max={200} step={1} value={radius} disabled={!loaded || busy} onChange={event => setRadius(event.target.valueAsNumber)} /></Field>
    <Notice>Chỉ Admin cấu hình; áp dụng cho tất cả POI, lưu lịch sử và ghi Audit Log. POI Manager không chỉnh bán kính riêng.</Notice>
    {error && <Notice>{error}</Notice>}
    <button className="primary-button" disabled={!loaded || busy}>Áp dụng bán kính</button>
  </form>
}
