import { useId, useState } from 'react'
import { FileAudio, FileText, Globe, Layers, MapPin, QrCode, Radio, Sparkles } from 'lucide-react'
import { useAdmin } from '../../admin/store'
import './statistics.css'

const colors = ['#79c9e6', '#efa6bd', '#b7add9', '#f1d493', '#82cbb6', '#a4b5c4']
const number = (value: number) => value.toLocaleString('vi-VN')
const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0
const monthFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
const monthKey = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return monthFormatter.format(date)
}

function Progress({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return <div className="stat-progress">
    <div><span>{label}</span><strong>{number(value)} / {number(total)} <small>({total ? `${percent(value, total)}%` : '—'})</small></strong></div>
    <div className="stat-progress-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(total, 1)} aria-valuenow={value} aria-valuetext={total ? `${value} trên ${total}` : 'Chưa có dữ liệu'}><i style={{ width: `${percent(value, total)}%`, background: color }} /></div>
  </div>
}

export function Statistics() {
  const { data, can, busy, tableCounts } = useAdmin()
  const [months, setMonths] = useState(6)
  const chartId = useId().replace(/:/g, '')
  const viewPois = can('poi.view')
  const viewAudio = can('audio.view_tasks')
  const activeLanguages = data.languages.filter(language => language.is_active)
  const pois = data.pois.filter(poi => poi.status !== 'archived')
  const published = pois.filter(poi => poi.status === 'published')
  const content = pois.flatMap(poi => activeLanguages.map(language => poi.content[language.code]))
  const textCount = content.filter(item => item?.text?.trim()).length
  const audioCount = content.filter(item => item?.audio_url).length
  const expectedContent = pois.length * activeLanguages.length
  const withCover = pois.filter(poi => poi.cover_image || poi.images.length).length
  const withQr = pois.filter(poi => poi.qr_code).length
  const queued = data.tasks.filter(task => task.status === 'queued' || task.status === 'processing').length
  const completed = data.tasks.filter(task => task.status === 'completed').length
  const failed = data.tasks.filter(task => task.status === 'failed').length
  const terminal = completed + failed
  const now = new Date()
  const thisMonth = monthKey(now.toISOString())
  const newPois = data.pois.filter(poi => monthKey(poi.created_at) === thisMonth).length
  const monthAudio = data.tasks.filter(task => task.status === 'completed' && monthKey(task.finished_at) === thisMonth).length
  const cards = [
    { label: 'Tổng địa điểm', value: data.pois.length, note: `${newPois} địa điểm tạo trong tháng`, icon: MapPin, tone: 'peach', visible: viewPois },
    { label: 'Sự kiện analytics', value: tableCounts.analytics_events ?? 0, note: 'Số dòng trong bảng analytics_events', icon: Radio, tone: 'mint', visible: viewPois },
    { label: 'Khu vực hoạt động', value: data.zones.filter(zone => zone.is_active).length, note: `${data.zones.length} khu vực trong hệ thống`, icon: Layers, tone: 'lilac', visible: viewPois },
    { label: 'Ngôn ngữ đang bật', value: activeLanguages.length, note: `${data.languages.length} ngôn ngữ đã cấu hình`, icon: Globe, tone: 'sand', visible: viewPois },
    { label: 'Kịch bản thuyết minh', value: textCount, note: 'Trên ngôn ngữ đang bật', icon: FileText, tone: 'blue', visible: viewPois },
    { label: 'Bản nội dung có audio', value: audioCount, note: 'Không tính địa điểm lưu trữ', icon: FileAudio, tone: 'pink', visible: viewPois },
    { label: 'Địa điểm có mã QR', value: withQr, note: `Trên ${pois.length} địa điểm chưa lưu trữ`, icon: QrCode, tone: 'mint', visible: viewPois },
    { label: 'Audio đang chờ / xử lý', value: queued, note: `${completed} hoàn tất · ${failed} thất bại`, icon: Sparkles, tone: 'peach', visible: viewAudio },
  ].filter(card => card.visible)
  const categoryCounts = new Map<string, number>()
  for (const poi of data.pois) {
    const category = poi.category?.trim() || 'Chưa phân loại'
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
  }
  const sortedCategories = [...categoryCounts].sort((left, right) => right[1] - left[1])
  const categories = sortedCategories.length > 6
    ? [...sortedCategories.slice(0, 5), ['Danh mục còn lại', sortedCategories.slice(5).reduce((total, item) => total + item[1], 0)] as [string, number]]
    : sortedCategories
  let offset = 0
  const segments = categories.map(([label, value], index) => {
    const start = offset
    offset += value / data.pois.length * 100
    return { label, value, color: colors[index], start, size: offset - start }
  })
  const vietnamDate = monthFormatter.formatToParts(now)
  const year = Number(vietnamDate.find(part => part.type === 'year')?.value)
  const month = Number(vietnamDate.find(part => part.type === 'month')?.value) - 1
  const timeline = Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(year, month - months + index + 1, 15))
    const key = monthKey(date.toISOString())
    return {
      label: `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`,
      pois: viewPois ? data.pois.filter(poi => monthKey(poi.created_at) === key).length : 0,
      audio: viewAudio ? data.tasks.filter(task => task.status === 'completed' && monthKey(task.finished_at) === key).length : 0,
    }
  })
  const scale = Math.max(4, Math.ceil(Math.max(...timeline.flatMap(item => [item.pois, item.audio])) / 4) * 4)
  const xPoint = (index: number) => 44 + index * 640 / (months - 1)
  const yPoint = (value: number) => 208 - value / scale * 168
  const series = [
    { key: 'pois' as const, label: 'Địa điểm được tạo', color: '#8d82b0', visible: viewPois },
    { key: 'audio' as const, label: 'Tác vụ audio hoàn tất', color: '#df91ac', visible: viewAudio },
  ].filter(item => item.visible)
  if (!viewPois && !viewAudio) return null
  return <section className="home-statistics" aria-label="Thống kê tổng quan" aria-busy={busy}>
    <div className="stat-cards">{cards.map(({ label, value, note, icon: Icon, tone }) => <article className="panel stat-card" key={label}>
      <div><p>{label}</p><strong>{number(value)}</strong><small>{note}</small></div><span className={`stat-icon stat-${tone}`}><Icon size={19} /></span>
    </article>)}</div>
    <div className={`stat-charts ${!viewPois ? 'stat-charts-single' : ''}`}>
      {viewPois && <article className="panel stat-category"><h2>Địa điểm theo danh mục</h2><p className="stat-caption">Toàn bộ địa điểm, kể cả đã lưu trữ</p>
        <div className="stat-donut"><svg viewBox="0 0 160 160" role="img" aria-label={`Phân bố ${data.pois.length} địa điểm theo danh mục`}>
          <circle cx="80" cy="80" r="59" fill="none" stroke="#edf1f6" strokeWidth="23" />
          {segments.map(segment => <circle key={segment.label} cx="80" cy="80" r="59" fill="none" pathLength="100" stroke={segment.color} strokeWidth="23" strokeDasharray={`${segment.size} ${100 - segment.size}`} strokeDashoffset={-segment.start} transform="rotate(-90 80 80)"><title>{`${segment.label}: ${segment.value}`}</title></circle>)}
          <text x="80" y="80" textAnchor="middle" className="stat-donut-total">{number(data.pois.length)}</text><text x="80" y="99" textAnchor="middle" className="stat-donut-label">địa điểm</text>
        </svg></div>
        <ul className="stat-legend">{segments.map(segment => <li key={segment.label}><i style={{ background: segment.color }} /><span>{segment.label}</span><strong>{number(segment.value)} <small>({percent(segment.value, data.pois.length)}%)</small></strong></li>)}</ul>
        {!segments.length && <p className="stat-caption">Chưa có địa điểm để phân loại.</p>}
      </article>}
      <article className="panel stat-monthly"><div className="stat-heading"><div><h2>Xu hướng nội dung theo tháng</h2><p className="stat-caption">Theo thời điểm tạo địa điểm và hoàn tất tác vụ (UTC+7)</p></div><select aria-label="Khoảng thống kê theo tháng" value={months} onChange={event => setMonths(Number(event.target.value))}><option value={6}>6 tháng gần đây</option><option value={12}>12 tháng gần đây</option></select></div>
        <div className="stat-series">{series.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div>
        <div className="stat-chart-scroll"><svg viewBox="0 0 720 250" role="img" aria-label={`Biểu đồ số địa điểm tạo mới và tác vụ audio hoàn tất trong ${months} tháng`}>
          <defs>{series.map(item => <linearGradient key={item.key} id={`${chartId}-${item.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity=".5" /><stop offset="100%" stopColor={item.color} stopOpacity=".08" /></linearGradient>)}</defs>
          {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1="44" x2="684" y1={yPoint(tick * scale / 4)} y2={yPoint(tick * scale / 4)} stroke="#edf0f4" /><text x="32" y={yPoint(tick * scale / 4) + 4} textAnchor="end">{number(tick * scale / 4)}</text></g>)}
          {series.map(item => {
            const points = timeline.map((entry, index) => `${xPoint(index)},${yPoint(entry[item.key])}`).join(' ')
            return <g key={item.key}><polygon points={`44,208 ${points} 684,208`} fill={`url(#${chartId}-${item.key})`} /><polyline points={points} fill="none" stroke={item.color} strokeWidth="2.5" />{timeline.map((entry, index) => <circle key={entry.label} cx={xPoint(index)} cy={yPoint(entry[item.key])} r="3" fill={item.color}><title>{`${entry.label} · ${item.label}: ${entry[item.key]}`}</title></circle>)}</g>
          })}
          {timeline.map((entry, index) => <text key={entry.label} x={xPoint(index)} y="233" textAnchor="middle">{entry.label}</text>)}
        </svg></div>
        {!timeline.some(item => item.pois || item.audio) && <p className="stat-caption">Chưa có phát sinh trong khoảng thời gian này.</p>}
        <details className="stat-data"><summary>Xem số liệu chi tiết</summary><div className="table-wrap"><table><thead><tr><th>Tháng</th>{series.map(item => <th key={item.key}>{item.label}</th>)}</tr></thead><tbody>{timeline.map(entry => <tr key={entry.label}><td>{entry.label}</td>{series.map(item => <td key={item.key}>{number(entry[item.key])}</td>)}</tr>)}</tbody></table></div></details>
      </article>
    </div>
    <div className="stat-bottom">
      {viewPois && <article className="panel"><h2>Độ phủ nội dung</h2><p className="stat-caption">Địa điểm chưa lưu trữ × ngôn ngữ đang bật</p><Progress label="Có kịch bản" value={textCount} total={expectedContent} color="#aca1cf" /><Progress label="Có audio" value={audioCount} total={expectedContent} color="#79c9e6" /><p className="stat-footnote">Còn thiếu {number(expectedContent - textCount)} kịch bản và {number(expectedContent - audioCount)} bản audio.</p></article>}
      {viewPois && <article className="panel"><h2>Tổng quan địa điểm</h2><p className="stat-caption">Không bao gồm địa điểm đã lưu trữ</p><Progress label="Đã công khai" value={published.length} total={pois.length} color="#82cbb6" /><Progress label="Có hình ảnh" value={withCover} total={pois.length} color="#efa6bd" /><Progress label="Đã gán mã QR" value={withQr} total={pois.length} color="#79c9e6" /></article>}
      {viewAudio && <article className="panel stat-audio-summary"><h2>Hiệu quả xử lý audio</h2><strong className="stat-big-number">{terminal ? `${percent(completed, terminal)}%` : '—'}</strong><p className="stat-caption">Tỷ lệ hoàn tất trên tác vụ hoàn tất hoặc thất bại</p><dl><div><dt>Hoàn tất trong tháng này</dt><dd>{number(monthAudio)}</dd></div><div><dt>Đang chờ / xử lý</dt><dd>{number(queued)}</dd></div><div><dt>Thất bại cần kiểm tra</dt><dd>{number(failed)}</dd></div><div><dt>Đã hủy</dt><dd>{number(data.tasks.filter(task => task.status === 'cancelled').length)}</dd></div></dl></article>}
    </div>
    <p className="stat-footnote">Thống kê từ các bản ghi hiện có và quyền truy cập của bạn; tháng hiện tại chưa kết thúc. Bản ghi đã xóa không nằm trong biểu đồ.</p>
  </section>
}
