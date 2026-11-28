import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Poi, Zone } from '../../admin/types'
import { Field } from '../../shared/ui'
import { locationInZone, validLocation } from './location'

type Props = { value: Poi['location']; zone?: Zone; disabled: boolean; onChange: (location: Poi['location']) => void }

const environment = (import.meta as ImportMeta & { env: Record<string, string> }).env
const mapboxToken = environment.VITE_MAPBOX_ACCESS_TOKEN?.trim()
const zoneSource = 'selected-zone'

export function PoiLocationPicker({ value, zone, disabled, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const styleReady = useRef(false)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const current = useRef({ value, disabled, onChange })
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [mapError, setMapError] = useState('')
  const mounted = useRef(false)
  current.current = { value, disabled, onChange }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!container.current || !mapboxToken) return
    const initial = current.current.value
    let instance: mapboxgl.Map
    try {
      instance = new mapboxgl.Map({
        accessToken: mapboxToken,
        container: container.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: validLocation(initial) ? [initial.lng, initial.lat] : [106.6955, 10.777],
        zoom: 16,
        maxZoom: 19,
        scrollZoom: false,
      })
    } catch {
      setMapError('Không thể khởi tạo bản đồ Mapbox. Bạn vẫn có thể nhập tọa độ bên dưới.')
      return
    }

    map.current = instance
    instance.on('style.load', () => { styleReady.current = true })
    instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    instance.on('error', () => setMapError('Không tải được một phần bản đồ Mapbox. Hãy kiểm tra kết nối và cấu hình Mapbox.'))

    const pin = new mapboxgl.Marker({ color: '#df493e', draggable: !current.current.disabled })
      .setLngLat(instance.getCenter())
      .addTo(instance)
    pin.getElement().setAttribute('aria-label', 'Ghim vị trí điểm tham quan')
    marker.current = pin

    function choose(lngLat: mapboxgl.LngLat) {
      if (current.current.disabled) return
      current.current.onChange({ lat: Number(lngLat.lat.toFixed(6)), lng: Number(lngLat.wrap().lng.toFixed(6)) })
    }
    instance.on('click', event => choose(event.lngLat))
    pin.on('dragend', () => choose(pin.getLngLat()))

    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container.current)
    return () => {
      styleReady.current = false
      observer.disconnect()
      pin.remove()
      instance.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    const pin = marker.current
    if (!instance || !pin) return
    if (validLocation(value)) {
      const coordinates: mapboxgl.LngLatLike = [value.lng, value.lat]
      pin.setLngLat(coordinates)
      if (!instance.getBounds()?.contains(coordinates)) instance.jumpTo({ center: coordinates })
    }
    pin.getElement().style.visibility = validLocation(value) ? '' : 'hidden'
    pin.setDraggable(!disabled)
  }, [value.lat, value.lng, disabled])

  useEffect(() => {
    const instance = map.current
    if (!instance || !zone) return
    const [west, south, east, north] = zone.map_region.bbox
    const ring = zone.boundary?.length
      ? [...zone.boundary]
      : [[west, south], [east, south], [east, north], [west, north]]
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first)

    function drawZone() {
      if (!instance || instance.getSource(zoneSource)) return
      instance.addSource(zoneSource, {
        type: 'geojson',
        data: { type: 'Polygon', coordinates: [ring] },
      })
      instance.addLayer({ id: 'zone-fill', type: 'fill', source: zoneSource, paint: { 'fill-color': '#087fa7', 'fill-opacity': 0.08 } })
      instance.addLayer({ id: 'zone-outline', type: 'line', source: zoneSource, paint: { 'line-color': '#087fa7', 'line-width': 2 } })
    }

    if (styleReady.current) drawZone()
    else instance.on('style.load', drawZone)

    return () => {
      if (map.current !== instance) return
      instance.off('style.load', drawZone)
      if (instance.getLayer('zone-outline')) instance.removeLayer('zone-outline')
      if (instance.getLayer('zone-fill')) instance.removeLayer('zone-fill')
      if (instance.getSource(zoneSource)) instance.removeSource(zoneSource)
    }
  }, [zone])

  const zoneId = zone?.zone_id
  const [west, south, east, north] = zone?.map_region.bbox ?? []
  useEffect(() => {
    if (west === undefined || south === undefined || east === undefined || north === undefined) return
    map.current?.fitBounds([west, south, east, north], { padding: 20, maxZoom: 16, duration: 0 })
  }, [zoneId, west, south, east, north])

  function showZone() {
    if (!zone || !map.current) return
    const [west, south, east, north] = zone.map_region.bbox
    map.current.fitBounds([west, south, east, north], { padding: 20, maxZoom: 16, duration: 0 })
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
      map.current?.jumpTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 17 })
    }, () => {
      if (!mounted.current) return
      setLocating(false)
      setError('Không lấy được vị trí. Hãy cho phép định vị hoặc chọn trực tiếp trên bản đồ.')
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }

  return <section className="poi-location-picker" aria-label="Chọn vị trí địa điểm">
    <h3>Vị trí trên bản đồ</h3>
    <p>{zone ? 'Bấm trên bản đồ hoặc kéo ghim để đặt vị trí trong khu vực đã chọn.' : 'Chọn khu vực trước khi đặt vị trí trên bản đồ.'}</p>
    <div className="admin-actions">
      {zone && <button type="button" className="secondary-button" onClick={showZone}>Xem toàn khu vực</button>}
      <button type="button" className="secondary-button" disabled={disabled || locating} onClick={locate}>{locating ? 'Đang lấy vị trí…' : 'Dùng vị trí hiện tại của tôi'}</button>
      <small>Chỉ dùng định vị khi bạn đang đứng tại địa điểm cần thêm.</small>
    </div>
    <div ref={container} className="poi-location-map" role="region" aria-label="Bản đồ chọn vị trí. Có thể nhập tọa độ trong phần nâng cao bên dưới." />
    {!mapboxToken && <p className="admin-error" role="alert">Chưa cấu hình khóa Mapbox. Bạn vẫn có thể nhập tọa độ bên dưới.</p>}
    {mapError && <p className="admin-error" role="alert">{mapError}</p>}
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
