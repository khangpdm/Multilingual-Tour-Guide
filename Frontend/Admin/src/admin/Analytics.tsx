import { useState, type FormEvent } from 'react'
import { api, dateLabel, useAdmin, type Permission } from './store'
import { downloadApi, downloadCsv, Empty, fieldLabel, Field, Heading, Notice, ResultTable, saveBlob, Status } from './ui'

type Report = { id: string; label: string; path: string; permission: Permission; exportId?: string }
const reports: Report[] = [
  { id: 'top', label: 'Top POI', path: '/admin/analytics/poi/top', permission: 'analytics.view_poi_reports', exportId: 'poi_top_plays' },
  { id: 'qr', label: 'Tỷ lệ QR', path: '/admin/analytics/poi/qr-rate', permission: 'analytics.view_poi_reports', exportId: 'poi_qr_rate' },
  { id: 'gaps', label: 'Thiếu nội dung / audio', path: '/admin/analytics/poi/content-gaps', permission: 'analytics.view_poi_reports', exportId: 'poi_content_gaps' },
  { id: 'languages', label: 'Ngôn ngữ theo thiết bị', path: '/admin/analytics/users/language-distribution', permission: 'analytics.view_user_reports', exportId: 'user_language_distribution' },
  { id: 'offline', label: 'Tải gói offline', path: '/admin/analytics/users/offline-pack-adoption', permission: 'analytics.view_user_reports', exportId: 'offline_pack_adoption' },
  { id: 'cache', label: 'Cache-hit-rate', path: '/admin/analytics/system/cache-hit-rate', permission: 'analytics.view_overview', exportId: 'cache_hit_rate' },
  { id: 'heatmap', label: 'Heatmap theo giờ', path: '/admin/heatmap', permission: 'heatmap.view_live' },
  { id: 'trend', label: 'Xu hướng lượt ghé', path: '/admin/analytics/heatmap/trend', permission: 'heatmap.view_trend', exportId: 'heatmap_trend' },
]
type RecordValue = Record<string, unknown>
type Point = { poi_id: string; name: string; lat: number; lng: number; visit_count: number; level: string }
const dateKey = (offset = 0) => new Date(Date.now() + 7 * 3600000 - offset * 86400000).toISOString().slice(0, 10)
function flatten(result: RecordValue): RecordValue[] {
  for (const key of ['items', 'distribution', 'series', 'points']) if (Array.isArray(result[key])) return result[key] as RecordValue[]
  if (Array.isArray(result.missing_translation)) return [
    ...(result.missing_translation as RecordValue[]).map(item => ({ ...item, type: 'missing_translation' })),
    ...((result.missing_pregen_audio || []) as RecordValue[]).map(item => ({ ...item, type: 'missing_pregen_audio' })),
  ]
  return [Object.fromEntries(Object.entries(result).filter(([, value]) => typeof value !== 'object' || value === null))]
}
function SpatialHeatmap({ points }: { points: Point[] }) {
  if (!points.length) return <Empty text="Không có POI công khai đạt tối thiểu 5 lượt ghé trong giờ đã chọn." />
  const minLng = Math.min(...points.map(point => point.lng)), maxLng = Math.max(...points.map(point => point.lng))
  const minLat = Math.min(...points.map(point => point.lat)), maxLat = Math.max(...points.map(point => point.lat))
  const colors: Record<string, string> = { low: '#247c7a', medium: '#c18b20', high: '#c5523c', unknown: '#697885' }
  return <><div className="spatial-map"><svg viewBox="0 0 800 360" role="img" aria-label="Phân bố POI theo tọa độ, không phải bản đồ nền"><defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d5e3df" /></pattern></defs><rect width="800" height="360" fill="url(#map-grid)" />{points.map(point => { const horizontal = maxLng === minLng ? 400 : 60 + (point.lng - minLng) / (maxLng - minLng) * 680; const vertical = maxLat === minLat ? 180 : 300 - (point.lat - minLat) / (maxLat - minLat) * 240; return <g key={point.poi_id}><circle cx={horizontal} cy={vertical} r={12 + Math.min(24, Math.sqrt(point.visit_count))} fill={colors[point.level] || colors.unknown} fillOpacity="0.35" /><circle cx={horizontal} cy={vertical} r="5" fill={colors[point.level] || colors.unknown}><title>{point.name}: {point.visit_count} lượt · {point.level}</title></circle><text x={horizontal} y={vertical - 32} textAnchor="middle" fontSize="12">{point.name}</text></g> })}<text x="12" y="22" fontSize="12">Bắc ↑ · Đông →</text></svg></div><p className="page-subtitle">Sơ đồ tọa độ, không phải bản đồ nền. Mức độ do server tính từ cùng giờ trong 28 ngày trước; dưới 7 ngày dữ liệu là “Chưa đủ dữ liệu”.</p><div className="admin-actions">{['low', 'medium', 'high', 'unknown'].map(level => <Status key={level} value={level} />)}</div></>
}
function TrendChart({ rows }: { rows: RecordValue[] }) {
  if (!rows.length) return <Empty />
  const values = rows.map(row => Number(row.visit_count) || 0)
  const maximum = Math.max(1, ...values)
  const coordinates = values.map((value, index) => `${40 + index / Math.max(1, values.length - 1) * 720},${220 - value / maximum * 180}`).join(' ')
  return <div className="trend-chart"><svg viewBox="0 0 800 260" role="img" aria-label={`Xu hướng lượt ghé, cao nhất ${maximum}`}><path d="M40 20V220H770" fill="none" stroke="#ccd9d5" /><polyline points={coordinates} fill="none" stroke="#247c7a" strokeWidth="3" /><text x="5" y="35" fontSize="12">{maximum}</text><text x="40" y="248" fontSize="11">{dateLabel(String(rows[0].bucket_start))}</text><text x="770" y="248" textAnchor="end" fontSize="11">{dateLabel(String(rows[rows.length - 1].bucket_start))}</text></svg><small>Múi giờ UTC+7 · Mốc không có lượt ghé được server trả 0.</small></div>
}
export function Analytics() {
  const { data, mode, can } = useAdmin()
  const available = reports.filter(report => can(report.permission))
  const [reportId, setReportId] = useState(available[0]?.id || '')
  const report = available.find(item => item.id === reportId)
  const [from, setFrom] = useState(dateKey(29))
  const [to, setTo] = useState(dateKey())
  const [date, setDate] = useState(dateKey())
  const [hour, setHour] = useState(Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23' }).format(new Date())))
  const [metric, setMetric] = useState('audio_plays')
  const [language, setLanguage] = useState('vi')
  const [limit, setLimit] = useState(10)
  const [days, setDays] = useState(30)
  const [targetType, setTargetType] = useState('poi_id')
  const [target, setTarget] = useState('')
  const [granularity, setGranularity] = useState('day')
  const [zone, setZone] = useState('')
  const [format, setFormat] = useState('csv')
  const [result, setResult] = useState<RecordValue | null>(null)
  const [loadedQuery, setLoadedQuery] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  function params() {
    const query = new URLSearchParams()
    if (reportId === 'heatmap') { query.set('date', date); query.set('hour', String(hour)) }
    else if (reportId === 'offline') query.set('days', String(days))
    else if (reportId === 'gaps') { if (zone) query.set('zone_id', zone); query.set('limit', String(limit)) }
    else { query.set('from', `${from}T00:00:00+07:00`); query.set('to', `${to}T23:59:59.999+07:00`) }
    if (['top', 'qr', 'heatmap'].includes(reportId)) query.set('lang', language)
    if (['top', 'qr'].includes(reportId)) query.set('limit', String(limit))
    if (reportId === 'top') query.set('metric', metric)
    if (reportId === 'trend') { query.set(targetType, target); query.set('granularity', granularity) }
    return query
  }
  function validate() {
    if (!report) throw new Error('Không có quyền xem báo cáo này.')
    if (!['heatmap', 'offline', 'gaps'].includes(reportId)) {
      const length = (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1
      if (!Number.isFinite(length) || length < 1 || length > (reportId === 'trend' && granularity === 'hour' ? 14 : 366)) throw new Error('Khoảng ngày không hợp lệ: tối đa 366 ngày; xu hướng theo giờ tối đa 14 ngày.')
    }
    if (reportId === 'trend' && !target.trim()) throw new Error('Nhập đúng một POI ID hoặc Zone ID.')
  }
  async function load(event: FormEvent) {
    event.preventDefault(); setMessage(''); setResult(null); setPending(true)
    try {
      validate(); const query = params(); setLoadedQuery(query.toString())
      if (mode === 'live') setResult(await api<RecordValue>(`${report!.path}?${query}`))
      else if (reportId === 'gaps') {
        const pois = data.pois.filter(poi => poi.status === 'published' && (!zone || poi.zone_id === zone))
        const codes = data.languages.filter(item => item.is_active).map(item => item.code)
        const missing_translation = pois.map(poi => ({ poi_id: poi.poi_id, missing_locales: codes.filter(code => !poi.content[code]?.text) })).filter(item => item.missing_locales.length)
        const missing_pregen_audio = pois.map(poi => ({ poi_id: poi.poi_id, missing_locales: codes.filter(code => !poi.content[code]?.audio_url) })).filter(item => item.missing_locales.length)
        setResult({ missing_translation: missing_translation.slice(0, limit), missing_pregen_audio: missing_pregen_audio.slice(0, limit), totals: { pois_checked: pois.length, pois_with_gaps: new Set([...missing_translation, ...missing_pregen_audio].map(item => item.poi_id)).size } })
      } else setMessage('Chưa có dữ liệu cho báo cáo này.')
    } catch (error) { setMessage((error as Error).message) } finally { setPending(false) }
  }
  const exportable = report?.exportId && can('analytics.export') && (reportId !== 'trend' || can('heatmap.export')) && (reportId !== 'top' || metric === 'audio_plays')
  const stale = loadedQuery !== params().toString()
  async function exportReport() {
    setPending(true); setMessage('')
    try {
      validate(); if (!result || stale || !exportable) throw new Error('Tải báo cáo với bộ lọc hiện tại trước khi xuất.')
      if (mode === 'live') { const query = new URLSearchParams(loadedQuery); query.set('report', report!.exportId!); query.set('format', format); await downloadApi(`/admin/analytics/export?${query}`, `${report!.exportId}.${format}`) }
      else if (format === 'xlsx') throw new Error('Chỉ có thể xuất CSV hoặc JSON trong chế độ hiện tại.')
      else if (format === 'json') saveBlob(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }), 'demo-content-gaps.json')
      else { const rows = flatten(result); const columns = [...new Set(rows.flatMap(row => Object.keys(row)))]; downloadCsv('demo-content-gaps.csv', [columns, ...rows.map(row => columns.map(column => typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column] ?? '')))]) }
    } catch (error) { setMessage((error as Error).message) } finally { setPending(false) }
  }
  if (!report) return <Empty text="Bạn không có quyền xem báo cáo." />
  const summary = result ? Object.entries(result).filter(([key, value]) => typeof value === 'number' && key !== 'hour') : []
  return <><Heading title="Phân tích & heatmap" detail="Báo cáo tổng hợp từ backend; múi giờ Asia/Ho_Chi_Minh (UTC+7)."><select className="select-control" aria-label="Định dạng báo cáo" value={format} onChange={event => setFormat(event.target.value)}><option value="csv">CSV</option><option value="xlsx">XLSX</option><option value="json">JSON</option></select>{exportable && <button className="secondary-button" disabled={pending || !result || stale} onClick={() => void exportReport()}>Xuất báo cáo</button>}</Heading><section className="panel"><div className="tabs">{available.map(item => <button disabled={pending} key={item.id} className={item.id === reportId ? 'tab-active' : ''} onClick={() => { setReportId(item.id); setResult(null); setMessage(''); setFrom(dateKey(item.id === 'cache' ? 6 : 29)); setTo(dateKey()); setLimit(item.id === 'gaps' || item.id === 'qr' ? 50 : 10) }}>{item.label}</button>)}</div><form className="filter-row" onSubmit={load}>
    {reportId === 'heatmap' ? <><Field label="Ngày"><input required type="date" value={date} onChange={event => setDate(event.target.value)} /></Field><Field label="Giờ (UTC+7)"><input required type="number" min="0" max="23" step="1" value={hour} onChange={event => setHour(event.target.valueAsNumber)} /></Field></> : reportId === 'offline' ? <Field label="Số ngày (1–90)"><input required type="number" min="1" max="90" value={days} onChange={event => setDays(event.target.valueAsNumber)} /></Field> : reportId !== 'gaps' && <><Field label="Từ ngày"><input required type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field><Field label="Đến ngày"><input required type="date" min={from} value={to} onChange={event => setTo(event.target.value)} /></Field></>}
    {reportId === 'top' && <Field label="Chỉ số"><select value={metric} onChange={event => setMetric(event.target.value)}><option value="audio_plays">Lượt nghe</option><option value="qr_scans">Quét QR</option><option value="visits">Lượt ghé</option></select></Field>}
    {['top', 'qr', 'gaps'].includes(reportId) && <Field label="Số kết quả"><input required type="number" min="1" max={reportId === 'gaps' ? 200 : 50} value={limit} onChange={event => setLimit(event.target.valueAsNumber)} /></Field>}
    {['top', 'qr', 'heatmap'].includes(reportId) && <Field label="Ngôn ngữ tên POI"><input required pattern="[a-z]{2,3}(-[A-Z]{2})?" value={language} onChange={event => setLanguage(event.target.value)} /></Field>}
    {reportId === 'gaps' && <Field label="Zone ID (tùy chọn)"><input value={zone} onChange={event => setZone(event.target.value)} /></Field>}
    {reportId === 'trend' && <><Field label="Đối tượng"><select value={targetType} onChange={event => { setTargetType(event.target.value); setTarget('') }}><option value="poi_id">Một POI</option><option value="zone_id">Một khu vực</option></select></Field><Field label={targetType}><input required value={target} onChange={event => setTarget(event.target.value)} /></Field><Field label="Gom theo"><select value={granularity} onChange={event => setGranularity(event.target.value)}><option value="hour">Giờ (tối đa 14 ngày)</option><option value="day">Ngày (tối đa 366 ngày)</option></select></Field></>}
    <button className="primary-button" disabled={pending}>{pending ? 'Đang tải…' : 'Xem báo cáo'}</button></form>
    {reportId === 'languages' && <Notice>Mỗi thiết bị được gán ngôn ngữ nghe nhiều nhất; hòa thì lấy ngôn ngữ gần nhất. Không tính tỷ lệ theo tổng lượt nghe.</Notice>}{reportId === 'qr' && <Notice>Tỷ lệ QR = lượt phát audio từ QR / tổng lượt phát × 100; không phải số lần quét / tổng lượt phát.</Notice>}{reportId === 'cache' && <Notice>MVP chỉ có tier1 và tier3; tier1_5 và tier2 trả 0.0. On-demand/presence thuộc giai đoạn 2.</Notice>}{reportId === 'top' && metric !== 'audio_plays' && <Notice>API xuất hiện chỉ đặc tả top lượt nghe. Có thể xem quét QR/lượt ghé nhưng chưa xuất hai biến thể này.</Notice>}{message && <Notice>{message}</Notice>}{result && <>{stale && <Notice>Bộ lọc đã thay đổi. Nhấn “Xem báo cáo” để cập nhật; dữ liệu bên dưới thuộc lần tải trước.</Notice>}<div className="admin-kpis">{summary.map(([key, value]) => <div className="mini-kpi" key={key}><span>{fieldLabel(key)}</span><strong>{String(value)}</strong></div>)}</div>{result.totals && <Notice>{Object.entries(result.totals as RecordValue).map(([key, value]) => `${fieldLabel(key)}: ${value}`).join(' · ')}</Notice>}{reportId === 'heatmap' && <SpatialHeatmap points={(result.points || []) as Point[]} />}{reportId === 'trend' && <TrendChart rows={(result.series || []) as RecordValue[]} />}<ResultTable rows={flatten(result)} /></>}{!result && !message && <Empty text="Chọn bộ lọc và nhấn Xem báo cáo." />}</section></>
}
