import { toast } from 'sonner'
import { useState } from 'react'
import { apiBase, assetUrl } from '../../admin/api'
import { poiName, useAdmin } from '../../admin/store'
import type { Poi } from '../../admin/types'
import { downloadApi, Empty, Field, Notice } from '../../shared/ui'

export function PoiImages({ poi }: { poi: Poi }) {
  const { can, mode, busy, mutate } = useAdmin()

  const editable = can('poi.edit') && poi.status !== 'archived' && mode === 'live'
  async function upload(file?: File) {
    if (!file) return
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5 MB.')
      const body = new FormData(); body.set('file', file)
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/images`, body, action: 'poi.image_add', target: poi.poi_id, demo: state => state })
      toast.success('Đã tải ảnh. Ảnh đầu tiên được chọn làm đại diện; có thể đổi bên dưới.')
    } catch (error) { toast.error((error as Error).message) }
  }
  async function order(images: string[], cover_image: string | null) {
    try {
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/images`, method: 'PUT', body: { images, cover_image }, action: 'poi.images_order', target: poi.poi_id, demo: state => state })
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
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/images/${encodeURIComponent(image.split('/').pop() || '')}`, method: 'DELETE', action: 'poi.image_remove', target: poi.poi_id, demo: state => state })
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

export function PoiQr({ poi, onAssign }: { poi: Poi; onAssign: (regenerate: boolean) => void }) {
  const { can, busy, mode } = useAdmin()

  const [loaded, setLoaded] = useState('')
  const url = `${apiBase}/admin/pois/${poi.poi_id}/qr/image?code=${encodeURIComponent(poi.qr_code || '')}`
  async function download() {
    try { await downloadApi(`/admin/pois/${poi.poi_id}/qr/image`, `qr-${poi.poi_id}.png`) } catch (error) { toast.error((error as Error).message) }
  }
  return <div className="admin-form">
    
    <Field label="Mã định danh QR"><input readOnly value={poi.qr_code || ''} placeholder="Chưa cấp mã" /></Field>
    {poi.qr_code && mode === 'live' && <section className="qr-print-card"><img key={url} src={url} width={260} height={260} alt={`Mã QR của ${poiName(poi)}`} onLoad={() => setLoaded(url)} onError={() => { setLoaded(''); toast.error('Không tải được ảnh QR. Kiểm tra kết nối và phiên đăng nhập.') }} /><h2>{poiName(poi)}</h2><p>Quét mã để mở thuyết minh địa điểm</p><small>{poi.qr_code}</small></section>}
    {mode === 'demo' && <Notice>Ảnh QR và tải/in cần kết nối API thật.</Notice>}
    <div className="admin-actions">
      {can('poi.assign_qr') && poi.status !== 'archived' && <button className="primary-button" disabled={busy} onClick={() => onAssign(Boolean(poi.qr_code))}>{poi.qr_code ? 'Tạo lại mã QR' : 'Cấp mã QR'}</button>}
      {poi.qr_code && mode === 'live' && <><button className="secondary-button" onClick={() => void download()}>Tải PNG</button><button className="secondary-button" disabled={loaded !== url} onClick={() => { document.body.classList.add('printing-poi-qr'); window.print(); document.body.classList.remove('printing-poi-qr') }}>In kèm tên địa điểm</button></>}
    </div>
    <Notice>Tạo lại QR sẽ thay mã hiện hành. Cần in lại biển QR cũ. Việc mobile nhận mã sẽ được tích hợp ở giai đoạn Enduser.</Notice>
  </div>
}
