import { useEffect, useRef, useState, type FormEvent } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { api } from '../../admin/api'
import { dateLabel, poiName, useAdmin } from '../../admin/store'
import { Empty, Field, Heading, Notice } from '../../shared/ui'

type Totals = { audio_plays: number; qr_scans: number; unique_devices: number; pack_downloads: number; total_duration_ms: number | null; average_duration_ms: number | null }
type Point = Totals & { poi_id: string; name: string; lng: number; lat: number; languages: { language_code: string | null; audio_plays: number }[] }
type Report = { totals: Totals; previous: Totals; series: { day: string; audio_plays: number; qr_scans: number; pack_downloads: number }[]; top: Point[]; points: Point[]; updated_at: string }

const environment = (import.meta as ImportMeta & { env: Record<string, string> }).env
const dateKey = (offset = 0) => new Date(Date.now() + 7 * 3600000 - offset * 86400000).toISOString().slice(0, 10)
const metrics: [keyof Totals, string][] = [
  ['audio_plays', 'Lượt nghe'], ['qr_scans', 'Lượt quét QR'], ['unique_devices', 'Thiết bị ẩn danh'],
  ['pack_downloads', 'Lượt tải gói ngoại tuyến'], ['total_duration_ms', 'Tổng thời lượng nghe'],
  ['average_duration_ms', 'Thời lượng nghe trung bình'],
]
const series = [
  { key: 'audio_plays', label: 'Lượt nghe', color: '#087fa7' },
  { key: 'qr_scans', label: 'Lượt quét QR', color: '#11845a' },
  { key: 'pack_downloads', label: 'Lượt tải', color: '#a34c1b' },
] as const
const format = (key: keyof Totals, value: number | null) =>
  value === null ? 'Chưa có dữ liệu' : key.endsWith('_ms') ? `${(value / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giây` : value.toLocaleString('vi-VN')

function Heatmap({ points, onSelect }: { points: Point[]; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const selection = useRef(onSelect)
  selection.current = onSelect

  useEffect(() => {
    if (!container.current || !points.length) return
    const accessToken = environment.VITE_MAPBOX_ACCESS_TOKEN?.trim()
    if (!accessToken) { setError('Chưa cấu hình khóa Mapbox.'); return }
    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        accessToken, container: container.current, style: 'mapbox://styles/mapbox/streets-v12',
        center: [points[0].lng, points[0].lat], zoom: 13, scrollZoom: false,
      })
    } catch {
      setError('Không thể khởi tạo bản đồ.'); return
    }
    map.on('error', () => setError('Không tải được một phần bản đồ Mapbox.'))
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }))
    map.on('load', () => {
      map.addSource('listening-pois', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: points.map(point => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
          properties: { id: point.poi_id, plays: point.audio_plays },
        })) },
      })
      const maxPlays = Math.max(1, ...points.map(point => point.audio_plays))
      map.addLayer({ id: 'listening-heat', type: 'heatmap', source: 'listening-pois', paint: {
        'heatmap-weight': ['/', ['get', 'plays'], maxPlays], 'heatmap-radius': 34, 'heatmap-opacity': 0.75,
      } })
      map.addLayer({ id: 'listening-markers', type: 'circle', source: 'listening-pois',
        paint: { 'circle-radius': 6, 'circle-color': '#076582', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
      map.on('click', 'listening-markers', event => {
        const feature = event.features?.[0] as { properties?: { id?: string } } | undefined
        const id = feature?.properties?.id
        if (typeof id === 'string') selection.current(id)
      })
      map.on('mouseenter', 'listening-markers', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'listening-markers', () => { map.getCanvas().style.cursor = '' })
      const bounds = new mapboxgl.LngLatBounds()
      points.forEach(point => bounds.extend([point.lng, point.lat]))
      map.fitBounds(bounds, { padding: 45, maxZoom: 15, duration: 0 })
    })
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)
    return () => { observer.disconnect(); map.remove() }
  }, [points])

  if (!points.length) return <Empty text="Chưa có lượt nghe để vẽ bản đồ nhiệt." />
  return <>{error && <p className="admin-error" role="alert">{error}</p>}
    <div className="analytics-map" ref={container} aria-label="Bản đồ nhiệt lượt nghe theo vị trí điểm tham quan" /></>
}

export function Analytics() {
  const { data, mode } = useAdmin()
  const [start, setStart] = useState(dateKey(6))
  const [end, setEnd] = useState(dateKey())
  const [zone, setZone] = useState('')
  const [poi, setPoi] = useState('')
  const [lang, setLang] = useState('')
  const [trigger, setTrigger] = useState('')
  const [query, setQuery] = useState(() => new URLSearchParams({ start, end }).toString())
  const [request, setRequest] = useState(0)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [mapKey, setMapKey] = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [heatmapPoints, setHeatmapPoints] = useState<Point[]>([])
  const lastHeatmap = useRef({ query: '', request: -1, time: 0 })

  useEffect(() => {
    if (mode !== 'live') return
    let cancelled = false
    let fetching = false
    async function load() {
      if (fetching) return
      fetching = true
      try {
        const result = await api<Report>(`/admin/analytics/dashboard?${query}`)
        if (!cancelled) {
          setReport(result)
          setError('')
          const time = Date.now()
          const previous = lastHeatmap.current
          if (previous.query !== query || previous.request !== request || time - previous.time >= 15 * 60 * 1000) {
            lastHeatmap.current = { query, request, time }
            setHeatmapPoints(result.points)
          }
        }
      } catch (reason) {
        if (!cancelled) setError((reason as Error).message)
      } finally {
        fetching = false
        if (!cancelled) setPending(false)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [mode, query, request])

  function submit(event: FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams({ start, end })
    for (const [key, value] of [['zone_id', zone], ['poi_id', poi], ['lang', lang], ['trigger', trigger]]) {
      if (value) params.set(key, value)
    }
    setPending(true)
    setSelectedId('')
    setQuery(params.toString())
    setRequest(current => current + 1)
  }

  const selected = report?.points.find(point => point.poi_id === selectedId) ?? report?.top.find(point => point.poi_id === selectedId)
  const max = Math.max(1, ...(report?.series ?? []).flatMap(day => series.map(metric => day[metric.key])))
  if (mode !== 'live') return <Empty text="Đăng nhập để xem số liệu du lịch thực tế." />
  return <>
    <Heading title="Phân tích & bản đồ nhiệt" detail="Thống kê trên toàn bộ điểm tham quan · UTC+7">
      {report && <small>Cập nhật lúc {dateLabel(report.updated_at)}</small>}
    </Heading>
    <section className="panel">
      <form className="filter-row" onSubmit={submit}>
        <Field label="Khoảng thời gian"><select value="" onChange={event => { setStart(dateKey(Number(event.target.value))); setEnd(dateKey()) }}>
          <option value="" disabled>Chọn khoảng nhanh</option><option value="0">Hôm nay</option><option value="6">7 ngày</option><option value="29">30 ngày</option>
        </select></Field>
        <Field label="Từ ngày"><input type="date" required max={dateKey()} value={start} onChange={event => setStart(event.target.value)} /></Field>
        <Field label="Đến ngày"><input type="date" required min={start} max={dateKey()} value={end} onChange={event => setEnd(event.target.value)} /></Field>
        <Field label="Khu vực"><select value={zone} onChange={event => { setZone(event.target.value); setPoi('') }}>
          <option value="">Tất cả khu vực</option>{data.zones.map(item => <option key={item.zone_id} value={item.zone_id}>{item.name}</option>)}
        </select></Field>
        <Field label="Điểm tham quan"><select value={poi} onChange={event => setPoi(event.target.value)}>
          <option value="">Tất cả điểm</option>{data.pois.filter(item => !zone || item.zone_id === zone).map(item => <option key={item.poi_id} value={item.poi_id}>{poiName(item)}</option>)}
        </select></Field>
        <Field label="Ngôn ngữ"><select value={lang} onChange={event => setLang(event.target.value)}>
          <option value="">Tất cả ngôn ngữ</option>{data.languages.map(item => <option key={item.code} value={item.code}>{item.native_name}</option>)}
        </select></Field>
        <Field label="Cách kích hoạt"><select value={trigger} onChange={event => setTrigger(event.target.value)}>
          <option value="">Tất cả</option><option value="geofence">Vùng địa lý</option><option value="qr_scan">Quét QR</option><option value="manual_tap">Chạm thủ công</option>
        </select></Field>
        <button className="primary-button" disabled={pending}>{pending ? 'Đang tải…' : 'Áp dụng bộ lọc'}</button>
      </form>
      {error && <p role="alert" className="admin-error">{error}</p>}
      {report && <>
        <div className="admin-kpis">{metrics.map(([key, label]) => <article className="mini-kpi" key={key}>
          <span>{label}</span><strong>{format(key, report.totals[key])}</strong><small>Kỳ trước: {format(key, report.previous[key])}</small>
        </article>)}</div>
        <div className="tabs"><button type="button" className={!showHeatmap ? 'tab-active' : ''} onClick={() => setShowHeatmap(false)}>Tổng quan</button>
          <button type="button" className={showHeatmap ? 'tab-active' : ''} onClick={() => setShowHeatmap(true)}>Bản đồ nhiệt</button></div>
        {showHeatmap ? <><Heatmap key={mapKey} points={heatmapPoints} onSelect={setSelectedId} />
          {!!heatmapPoints.length && <button type="button" className="secondary-button" onClick={() => setMapKey(key => key + 1)}>Tải lại bản đồ</button>}</>
          : report.totals.unique_devices === 0 ? <Empty text="Chưa có dữ liệu trong khoảng thời gian đã chọn." /> : <>
            <div className="trend-chart"><svg viewBox="0 0 800 230" role="img" aria-label="Biểu đồ lượt nghe, quét QR và tải gói theo ngày">
              <path d="M40 20V200H770" fill="none" stroke="#ccd9d5" />
              {series.map(metric => <polyline key={metric.key} fill="none" stroke={metric.color} strokeWidth="3"
                points={report.series.map((day, index) => `${report.series.length === 1 ? 410 : 40 + index / (report.series.length - 1) * 730},${200 - day[metric.key] / max * 170}`).join(' ')} />)}
              {report.series.length === 1 && series.map(metric => <circle key={metric.key} cx="410"
                cy={200 - report.series[0][metric.key] / max * 170} r="4" fill={metric.color} />)}
              <text x="40" y="224" fontSize="12">{report.series[0]?.day}</text>
              {report.series.length > 1 && <text x="770" y="224" textAnchor="end" fontSize="12">{report.series.at(-1)?.day}</text>}
            </svg><div className="chart-legend">{series.map(metric => <span key={metric.key}><i style={{ background: metric.color }} />{metric.label}</span>)}</div></div>
            <h3>Top 10 điểm tham quan</h3>
            <div className="table-wrap"><table><thead><tr><th>Điểm tham quan</th><th>Lượt nghe</th><th>Lượt quét QR</th></tr></thead>
              <tbody>{report.top.map(point => <tr key={point.poi_id}><td><button type="button" className="text-button" onClick={() => setSelectedId(point.poi_id)}>{point.name}</button></td><td>{point.audio_plays}</td><td>{point.qr_scans}</td></tr>)}</tbody></table></div>
          </>}
        {selected && <section className="analytics-poi-detail" aria-live="polite"><h3>{selected.name}</h3>
          <p>{selected.audio_plays} lượt nghe · {selected.qr_scans} lượt quét QR · Thời lượng trung bình {format('average_duration_ms', selected.average_duration_ms)}</p>
          <Notice>{selected.languages.length ? selected.languages.map(item => `${item.language_code ?? 'Không rõ'}: ${item.audio_plays} lượt nghe`).join(' · ') : 'Chưa có dữ liệu phân bố ngôn ngữ.'}</Notice>
        </section>}
      </>}
    </section>
  </>
}
