import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Notice } from '../../shared/ui'

type Vertex = [number, number]
type Props = { bbox: number[]; boundary: Vertex[]; disabled: boolean; onChange: (boundary: Vertex[]) => void }
const environment = (import.meta as ImportMeta & { env: Record<string, string> }).env

export function ZoneBoundaryMap({ bbox, boundary, disabled, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const initialBbox = useRef(bbox)
  const [drawing, setDrawing] = useState(false)
  const [vertices, setVertices] = useState<Vertex[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const editable = useRef(false)
  editable.current = drawing && !disabled

  useEffect(() => {
    if (!container.current) return
    const accessToken = environment.VITE_MAPBOX_ACCESS_TOKEN?.trim()
    if (!accessToken) { setError('Chưa cấu hình khóa Mapbox.'); return }
    let instance: mapboxgl.Map
    try {
      instance = new mapboxgl.Map({
        accessToken, container: container.current, style: 'mapbox://styles/mapbox/streets-v12',
        bounds: initialBbox.current as [number, number, number, number], fitBoundsOptions: { padding: 30 },
        scrollZoom: false,
      })
    } catch { setError('Không thể khởi tạo bản đồ.'); return }
    map.current = instance
    instance.on('error', () => setError('Không tải được một phần bản đồ.'))
    instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }))
    instance.on('load', () => {
      instance.addSource('zone-drawing', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      instance.addLayer({ id: 'zone-drawing-area', type: 'fill', source: 'zone-drawing', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#087fa7', 'fill-opacity': 0.16 } })
      instance.addLayer({ id: 'zone-drawing-line', type: 'line', source: 'zone-drawing', paint: { 'line-color': '#087fa7', 'line-width': 3 } })
      instance.addLayer({ id: 'zone-drawing-vertices', type: 'circle', source: 'zone-drawing', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#087fa7', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })
      setReady(true)
    })
    instance.on('click', event => {
      if (!editable.current) return
      const point = event.lngLat.wrap()
      setVertices(current => current.length < 499 ? [...current, [Number(point.lng.toFixed(6)), Number(point.lat.toFixed(6))]] : current)
    })
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container.current)
    return () => { observer.disconnect(); instance.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (!ready) return
    const points = drawing ? vertices : boundary
    const source = map.current?.getSource<mapboxgl.GeoJSONSource>('zone-drawing')
    source?.setData({
      type: 'FeatureCollection',
      features: [
        ...points.map(coordinates => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates } })),
        ...(drawing
          ? points.length >= 2 ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: points } }] : []
          : points.length >= 4 ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [points] } }] : []),
      ],
    })
    if (map.current) map.current.getCanvas().style.cursor = drawing ? 'crosshair' : ''
  }, [ready, drawing, vertices, boundary])

  return <section className="poi-location-picker">
    <h3>Ranh giới khu vực</h3>
    {error && <Notice>{error} Bạn có thể nhập tọa độ trong phần nâng cao.</Notice>}
    <div className="poi-location-map" ref={container} aria-label="Bản đồ vẽ ranh giới khu vực" />
    <div className="admin-actions">
      <button type="button" className="secondary-button" disabled={!ready || disabled || drawing} onClick={() => { setVertices([]); setDrawing(true) }}>Vẽ ranh giới</button>
      {drawing && <>
        <button type="button" className="secondary-button" disabled={!vertices.length || disabled} onClick={() => setVertices(current => current.slice(0, -1))}>Bỏ điểm cuối</button>
        <button type="button" className="primary-button" disabled={vertices.length < 3 || disabled} onClick={() => { onChange([...vertices, vertices[0]]); setDrawing(false) }}>Dùng ranh giới này</button>
        <button type="button" className="secondary-button" onClick={() => setDrawing(false)}>Hủy vẽ</button>
      </>}
    </div>
    {drawing && <p role="status">{vertices.length}/499 điểm. Bấm bản đồ để thêm đỉnh, rồi chọn “Dùng ranh giới này”.</p>}
  </section>
}
