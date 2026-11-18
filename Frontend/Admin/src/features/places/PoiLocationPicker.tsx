import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Poi, Zone } from '../../admin/types'
import { Field } from '../../shared/ui'
import { locationInZone, validLocation } from './location'

type Props = { value: Poi['location']; zone?: Zone; disabled: boolean; onChange: (location: Poi['location']) => void }

export function PoiLocationPicker({ value, zone, disabled, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const current = useRef({ value, disabled, onChange })
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [tileError, setTileError] = useState(false)
  const mounted = useRef(false)
  current.current = { value, disabled, onChange }

  useEffect(() => {
    if (!container.current) return
    mounted.current = true
    const initial = current.current.value
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(validLocation(initial) ? [initial.lat, initial.lng] : [10.777, 106.6955], 16)
    map.current = instance
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      referrerPolicy: 'strict-origin',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance)
    tiles.on('tileerror', () => setTileError(true))
    const pin = L.marker(instance.getCenter(), {
      draggable: !current.current.disabled,
      title: 'Vị trí địa điểm: kéo ghim để thay đổi',
      icon: L.divIcon({ className: 'poi-location-pin', html: '<span></span>', iconSize: [26, 34], iconAnchor: [13, 34] }),
    }).addTo(instance)
    marker.current = pin
    function choose(latlng: L.LatLng) {
      if (current.current.disabled) return
      current.current.onChange({ lat: Number(latlng.lat.toFixed(6)), lng: Number(latlng.wrap().lng.toFixed(6)) })
    }
    instance.on('click', (event: L.LeafletMouseEvent) => choose(event.latlng))
    pin.on('dragend', () => choose(pin.getLatLng()))
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }))
    observer.observe(container.current)
    return () => {
      mounted.current = false
      observer.disconnect()
      instance.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  useEffect(() => {
    if (!map.current || !marker.current) return
    if (validLocation(value)) {
      marker.current.setLatLng([value.lat, value.lng])
      if (!map.current.getBounds().contains([value.lat, value.lng])) map.current.panTo([value.lat, value.lng], { animate: false })
    }
    if (disabled) marker.current.dragging?.disable()
    else marker.current.dragging?.enable()
  }, [value.lat, value.lng, disabled])

  useEffect(() => {
    if (!map.current || !zone) return
    const [west, south, east, north] = zone.map_region.bbox
    const points: L.LatLngExpression[] = zone.boundary?.length ? zone.boundary.map(([lng, lat]) => [lat, lng]) : [[south, west], [south, east], [north, east], [north, west]]
    const outline = L.polygon(points, { color: '#087fa7', weight: 2, fillOpacity: 0.04, interactive: false }).addTo(map.current)
    return () => { outline.remove() }
  }, [zone])

  function showZone() {
    if (!zone || !map.current) return
    const [west, south, east, north] = zone.map_region.bbox
    map.current.fitBounds([[south, west], [north, east]], { padding: [20, 20], maxZoom: 16, animate: false })
  }

  function locate() {
    setError('')
    if (!navigator.geolocation) { setError('Trình duyệt không hỗ trợ định vị. Hãy chọn vị trí trên bản đồ.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(position => {
      if (!mounted.current) return
      setLocating(false)
      if (current.current.disabled) return
      current.current.onChange({ lat: Number(position.coords.latitude.toFixed(6)), lng: Number(position.coords.longitude.toFixed(6)) })
      map.current?.setView([position.coords.latitude, position.coords.longitude], 17, { animate: false })
    }, () => {
      if (!mounted.current) return
      setLocating(false)
      setError('Không lấy được vị trí. Hãy cho phép định vị hoặc chọn trực tiếp trên bản đồ.')
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }

  return <section className="poi-location-picker" aria-label="Chọn vị trí địa điểm">
    <h3>Vị trí trên bản đồ</h3>
    <p>Bấm vào đúng địa điểm hoặc kéo ghim để chọn vị trí. Không cần nhập vĩ độ, kinh độ.</p>
    <div className="admin-actions">
      {zone && <button type="button" className="secondary-button" onClick={showZone}>Xem toàn khu vực</button>}
      <button type="button" className="secondary-button" disabled={disabled || locating} onClick={locate}>{locating ? 'Đang lấy vị trí…' : 'Dùng vị trí hiện tại của tôi'}</button>
      <small>Chỉ dùng định vị khi bạn đang đứng tại địa điểm cần thêm.</small>
    </div>
    <div ref={container} className="poi-location-map" role="region" aria-label="Bản đồ chọn vị trí. Có thể nhập tọa độ trong phần nâng cao bên dưới." />
    {tileError && <p className="admin-error" role="alert">Không tải được một số ô bản đồ. Kiểm tra kết nối Internet; bạn vẫn có thể nhập tọa độ bên dưới.</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    <p aria-live="polite">{validLocation(value) ? `Vị trí đang chọn: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}. Bấm “Lưu thông tin” để áp dụng.` : 'Vui lòng chọn vị trí hợp lệ.'}</p>
    {zone && validLocation(value) && !locationInZone(value, zone) && <p className="admin-error" role="alert">Vị trí đang nằm ngoài khu vực “{zone.name}”. Bấm “Xem toàn khu vực” và chọn điểm trong đường viền xanh, hoặc đổi khu vực.</p>}
    <details className="poi-location-advanced"><summary>Nhập tọa độ thủ công (nâng cao)</summary><div className="form-grid">
      <Field label="Vĩ độ"><input type="number" min={-90} max={90} step="any" disabled={disabled} value={Number.isFinite(value.lat) ? value.lat : ''} onChange={event => onChange({ ...value, lat: event.target.valueAsNumber })} /></Field>
      <Field label="Kinh độ"><input type="number" min={-180} max={180} step="any" disabled={disabled} value={Number.isFinite(value.lng) ? value.lng : ''} onChange={event => onChange({ ...value, lng: event.target.valueAsNumber })} /></Field>
    </div></details>
    <small>Bản đồ nền cần Internet. Đường viền xanh thể hiện khu vực đã chọn.</small>
  </section>
}
