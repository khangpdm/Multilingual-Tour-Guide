import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { api, apiBase, apiFetch, ApiError, assetUrl, responseError } from '../../admin/api'
import { poiName, useAdmin } from '../../admin/store'
import type { Poi } from '../../admin/types'
import { Empty, Field, Notice, saveBlob } from '../../shared/ui'

export function PoiImages({ poi }: { poi: Poi }) {
  const { can, mode, busy, mutate } = useAdmin()

  const editable = can('poi.edit') && poi.status !== 'archived' && mode === 'live'
  async function upload(file?: File) {
    if (!file) return
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5 MB.')
      const body = new FormData(); body.set('file', file)
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/images`, body, action: 'poi.image_add', target: poi.poi_id, version: poi.content_version, demo: state => state })
      toast.success('Đã tải ảnh. Ảnh đầu tiên được chọn làm đại diện; có thể đổi bên dưới.')
    } catch (error) { toast.error((error as Error).message) }
  }
  async function order(images: string[], cover_image: string | null) {
    try {
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/images`, method: 'PUT', body: { images, cover_image }, action: 'poi.images_order', target: poi.poi_id, version: poi.content_version, demo: state => state })
      toast.success('Đã lưu thứ tự và ảnh đại diện.')
    } catch (error) { toast.error((error as Error).message) }
  }
  function move(index: number, direction: number) {
    const images = [...poi.images]
    const target = index + direction
    ;[images[index], images[target]] = [images[target], images[index]]
    void order(images, poi.cover_image || images[0])
  }
  async function remove(image: string) {
    if (!window.confirm('Gỡ ảnh khỏi POI? Bản snapshot offline đã tạo không bị xóa.')) return
    try {
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/images/${encodeURIComponent(image.split('/').pop() || '')}`, method: 'DELETE', action: 'poi.image_remove', target: poi.poi_id, version: poi.content_version, demo: state => state })
      toast.success('Đã gỡ ảnh khỏi địa điểm.')
    } catch (error) { toast.error((error as Error).message) }
  }
  return <div className="admin-form">
    
    <p>{poi.images.length}/10 ảnh · Ảnh đại diện xuất hiện trên thẻ địa điểm và bản xem trước.</p>
    {editable && <Field label="Thêm ảnh JPG PNG WebP tối đa 5 MB"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || poi.images.length >= 10} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></Field>}
    <div className="admin-image-grid">{poi.images.map((image, index) => <figure key={image} className={image === poi.cover_image ? 'cover-selected' : ''}>
      <img src={assetUrl(image)} alt={`${poiName(poi)} - ảnh ${index + 1}`} />
      <figcaption>{image === poi.cover_image ? 'Ảnh đại diện' : `Ảnh ${index + 1}`}</figcaption>
      {editable && <div className="admin-actions"><button className="text-button" disabled={busy || image === poi.cover_image} onClick={() => void order(poi.images, image)}>Đặt đại diện</button><button className="text-button" aria-label={`Đưa ảnh ${index + 1} lên trước`} disabled={busy || index === 0} onClick={() => move(index, -1)}>←</button><button className="text-button" aria-label={`Đưa ảnh ${index + 1} ra sau`} disabled={busy || index === poi.images.length - 1} onClick={() => move(index, 1)}>→</button><button className="text-button" disabled={busy} onClick={() => void remove(image)}>Gỡ ảnh</button></div>}
    </figure>)}</div>
    {!poi.images.length && <Empty text="Chưa có ảnh. Tải ảnh đầu tiên để chọn ảnh đại diện." />}
  </div>
}

type QrInfo = { qr_code: string; target_url: string; poi_name: string; is_local_preview: boolean }
type QrPreview = QrInfo & { imageUrl: string; blob: Blob }

export function PoiQr({ poi }: { poi: Poi }) {
  const { mode } = useAdmin()
  const [preview, setPreview] = useState<QrPreview | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const name = poiName(poi)
  useEffect(() => {
    const controller = new AbortController()
    let imageUrl = ''
    setPreview(null); setLoaded(false); setError(''); setLoading(false)
    if (mode !== 'live' || !poi.qr_code || poi.status === 'archived') return
    setLoading(true)
    async function load() {
      try {
        const path = `/admin/pois/${poi.poi_id}/qr`
        const info = await api<QrInfo>(`${path}/info`, { signal: controller.signal })
        const response = await apiFetch(`${apiBase}${path}/image`, { credentials: 'include', signal: controller.signal })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new ApiError(body?.error?.message || responseError(response.status), response.status, body?.error?.code)
        }
        if (!response.headers.get('Content-Type')?.includes('image/png')) throw new Error('Máy chủ không trả về ảnh QR hợp lệ.')
        const blob = await response.blob()
        if (controller.signal.aborted) return
        imageUrl = URL.createObjectURL(blob)
        setPreview({ ...info, imageUrl, blob })
      } catch (reason) {
        if (controller.signal.aborted) return
        if (reason instanceof ApiError && reason.status === 401) window.dispatchEvent(new Event('admin-session-expired'))
        setError(reason instanceof ApiError && reason.code === 'QR_BASE_URL_NOT_CONFIGURED' ? 'Chưa cấu hình địa chỉ ứng dụng cho QR. Bản triển khai thật cần PUBLIC_APP_URL là URL HTTPS; bản thử local cần APP_ENV=development và truy cập từ máy này.' : (reason as Error).message)
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => { controller.abort(); if (imageUrl) URL.revokeObjectURL(imageUrl) }
  }, [poi.poi_id, poi.qr_code, poi.status, name, mode, attempt])
  function print() {
    document.body.classList.add('printing-poi-qr')
    try { window.print() } finally { document.body.classList.remove('printing-poi-qr') }
  }
  return <div className="admin-form">
    <Field label="Mã định danh QR"><input readOnly value={poi.qr_code || ''} placeholder="Chưa cấp mã" /></Field>
    {loading && <Empty text="Đang tạo bản xem trước QR…" />}
    {error && <div><p className="admin-error" role="alert">{error}</p><button type="button" className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}
    {preview && !error && <>
      {preview.is_local_preview && <Notice>QR thử nghiệm local: mở đường dẫn trên máy này để nghe audio. Ứng dụng mobile có thể đọc token bằng màn Quét QR khi đã cấu hình kết nối backend. Camera điện thoại thông thường không mở được địa chỉ localhost; phát hành cho khách cần PUBLIC_APP_URL HTTPS truy cập được.</Notice>}
      <Field label="Đường dẫn được mã hóa trong QR"><input readOnly value={preview.target_url} /></Field>
      <section className="qr-print-card"><img key={preview.imageUrl} src={preview.imageUrl} width={260} alt={`Mã QR của ${preview.poi_name}`} onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setError('Không hiển thị được ảnh QR. Vui lòng thử tải lại.') }} /><h2>{preview.poi_name}</h2><p>{preview.is_local_preview ? 'QR thử nghiệm local · Quét trong ứng dụng đã kết nối backend' : 'Quét mã để mở địa điểm trên ứng dụng người dùng'}</p><small>{preview.qr_code}</small></section>
      <div className="admin-actions"><button type="button" className="secondary-button" disabled={!loaded} onClick={() => saveBlob(preview.blob, `qr-${preview.is_local_preview ? 'test-' : ''}${poi.poi_id}.png`)}>Tải PNG{preview.is_local_preview ? ' thử nghiệm' : ''}</button><button type="button" className="secondary-button" disabled={!loaded} onClick={print}>In kèm tên địa điểm</button></div>
      {!preview.is_local_preview && <Notice>Ảnh QR chứa đường dẫn ở trên. Chỉ xác nhận quét mở đúng địa điểm sau khi ứng dụng người dùng đã tích hợp và được kiểm thử.</Notice>}
    </>}
    {poi.status === 'archived' && <Notice>Địa điểm đã lưu trữ, QR đang ngừng hiệu lực. Khôi phục địa điểm để sử dụng lại mã cũ.</Notice>}
    {mode === 'demo' && <Notice>Ảnh QR và tải/in cần kết nối API thật.</Notice>}
    <Notice>QR được tạo tự động và không đổi suốt vòng đời POI. Khi lưu trữ, QR ngừng có hiệu lực; khôi phục sử dụng lại mã cũ.</Notice>
  </div>
}
