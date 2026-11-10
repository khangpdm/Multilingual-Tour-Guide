import { toast } from 'sonner'
import './globals.css'
import './admin/admin.css'
import './admin/theme.css'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, Search, FileAudio, Globe, LayoutDashboard, Eye, EyeOff, MapPin, Menu, ShieldCheck, Users, X } from 'lucide-react'
import { AdminProvider, dateLabel, useAdmin } from './admin/store'
import type { Permission } from './admin/types'
import { api } from './admin/api'
import { Accounts, AudioTasks, AuditLogs, Languages, Roles } from './features/management/Management'
import { PoiEditor, Pois, ZoneEditor, Zones } from './features/places/Places'
import { Analytics } from './features/analytics/Analytics'
import { OfflinePacks } from './features/offline/OfflinePacks'
import { Statistics } from './features/dashboard/Statistics'
import { DemoNotice, Empty, Field, Heading, Notice, Status } from './shared/ui'

const navigation: { label: string; href: string; icon: typeof MapPin; permissions?: Permission[] }[] = [
  { label: 'Trang chủ', href: '/', icon: LayoutDashboard },
  { label: 'Địa điểm', href: '/pois', icon: MapPin, permissions: ['poi.view'] },
  { label: 'Khu vực', href: '/zones', icon: MapPin, permissions: ['poi.view'] },
  { label: 'Ngôn ngữ', href: '/languages', icon: Globe, permissions: ['poi.view'] },
  { label: 'Tác vụ audio', href: '/audio-tasks', icon: FileAudio, permissions: ['audio.view_tasks'] },
  { label: 'Gói offline', href: '/offline-packs', icon: FileAudio, permissions: ['offline.view'] },
  { label: 'Phân tích & heatmap', href: '/analytics', icon: BarChart3, permissions: ['analytics.view_overview', 'analytics.view_poi_reports', 'analytics.view_user_reports', 'heatmap.view_live', 'heatmap.view_trend'] },
  { label: 'Tài khoản', href: '/accounts', icon: Users, permissions: ['user.view'] },
  { label: 'Vai trò & quyền', href: '/roles', icon: ShieldCheck, permissions: ['role.view'] },
  { label: 'Nhật ký thao tác', href: '/audit-logs', icon: Activity, permissions: ['audit.view'] },
]
function Shell({ children, title }: { children: ReactNode; title: string }) {
  const { user, mode, switchRole, can, data, logout, reload, busy } = useAdmin()
  const navigate = useNavigate()
  const path = useLocation().pathname
  const [open, setOpen] = useState(false)
  const [navigationQuery, setNavigationQuery] = useState('')

  return <div className="app-shell"><aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><div className="brand-mark"><MapPin size={18} /></div><span>Tour Guide<small>KHÔNG GIAN QUẢN TRỊ</small></span><button className="mobile-close" aria-label="Đóng menu" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="workspace-switcher"><div className="workspace-avatar">MT</div><div><p>Multilingual Tour Guide</p><span>Không gian quản trị</span></div></div><nav className="nav-list"><p className="nav-caption">ĐIỀU HƯỚNG</p>{navigation.filter(item => !item.permissions || item.permissions.some(can)).map(({ label, href, icon: Icon }) => <button key={href} aria-current={path === href ? 'page' : undefined} className={`nav-item ${path === href || (href !== '/' && path.startsWith(href + '/')) ? 'nav-active' : ''}`} onClick={() => { navigate(href); setOpen(false) }}><Icon size={18} /><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><div className="profile-row"><div className="profile-avatar">{user?.full_name?.slice(0, 1) || 'A'}</div><div><p>{user?.full_name || user?.email}</p><span>{user?.role_id}</span></div></div><button className="text-button" disabled={busy} onClick={() => { void logout().then(() => navigate('/login')).catch(reason => toast.error(reason.message)) }}>Đăng xuất</button></div></aside>{open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Đóng menu" />}<button className="menu-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={21} /></button><main className="main-content"><header className="topbar"><div className="breadcrumbs"><strong>{title}</strong></div><div className="navigation-search"><Search size={17} /><input aria-label="Tìm trang quản trị" placeholder="Tìm trang quản trị…" value={navigationQuery} onChange={event => setNavigationQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setNavigationQuery('') }} />{navigationQuery.trim() && <div className="navigation-results">{navigation.filter(item => (!item.permissions || item.permissions.some(can)) && item.label.toLocaleLowerCase('vi').includes(navigationQuery.trim().toLocaleLowerCase('vi'))).map(item => <button key={item.href} onClick={() => { navigate(item.href); setNavigationQuery('') }}>{item.label}</button>)}{!navigation.some(item => (!item.permissions || item.permissions.some(can)) && item.label.toLocaleLowerCase('vi').includes(navigationQuery.trim().toLocaleLowerCase('vi'))) && <p>Không tìm thấy trang phù hợp.</p>}</div>}</div><div className="topbar-actions">{mode === 'demo' ? <select className="role-switch" disabled={busy} value={user?.role_id} onChange={event => switchRole(event.target.value)} aria-label="Vai trò demo">{data.roles.filter(role => role.role_id !== 'user').map(role => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select> : <button className="secondary-button" disabled={busy} onClick={() => void reload()}>{busy ? 'Đang tải…' : 'Tải lại dữ liệu'}</button>}<div className="user-chip"><div className="profile-avatar">{user?.full_name?.slice(0, 1) || 'A'}</div><div><p>{user?.full_name || user?.username}</p><span>Quản trị viên</span></div></div></div></header><div className="page-body admin-page"><DemoNotice />{children}</div></main></div>
}
function Overview() {
  const { data, can, tableCounts, localDatabase } = useAdmin()
  const navigate = useNavigate()
  const published = data.pois.filter(poi => poi.status === 'published')
  const missing = published.filter(poi => data.languages.some(language => language.is_active && !poi.content[language.code]?.audio_url))
  const statusRows = [['Công khai', 'published', '#28abe3'], ['Chưa công khai', 'unpublished', '#a6dff6'], ['Đã lưu trữ', 'archived', '#536775']] as const
  const localeRows = data.languages.filter(language => language.is_active).map(language => ({ ...language, withText: published.filter(poi => Boolean(poi.content[language.code]?.text?.trim())).length, withAudio: published.filter(poi => Boolean(poi.content[language.code]?.audio_url)).length }))
  const taskStatuses = [['Đang chờ', 'queued'], ['Đang xử lý', 'processing'], ['Hoàn tất', 'completed'], ['Thất bại', 'failed'], ['Đã hủy', 'cancelled']] as const
  const accountStatuses = [['Đang hoạt động', 'active'], ['Chờ kích hoạt', 'pending_activation'], ['Đã vô hiệu hóa', 'deactivated']] as const
  const maxZoneCount = Math.max(1, ...data.zones.map(zone => data.pois.filter(poi => poi.zone_id === zone.zone_id).length))
  const auditDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return { key: date.toLocaleDateString('sv-SE'), label: date.toLocaleDateString('vi-VN', { weekday: 'short' }) } })
  const auditTrend = auditDays.map(day => data.audit.filter(log => new Date(log.timestamp).toLocaleDateString('sv-SE') === day.key).length)
  const trendMax = Math.max(1, ...auditTrend)
  const trendPoints = auditTrend.map((value, index) => (30 + index * 90) + ',' + (125 - value / trendMax * 95)).join(' ')
  return <div className="overview-page"><Heading title="Tổng quan quản trị" detail="Theo dõi nội dung, chất lượng thuyết minh và hoạt động của hệ thống." />
    <Statistics />
    <div className="dashboard-layout"><div className="dashboard-main">
<div className="dashboard-grid">
      {can('audit.view') && <section className="panel"><h2>Hoạt động 7 ngày gần đây</h2>{data.audit.length ? <div className="line-chart"><svg viewBox="0 0 620 150" role="img" aria-label="Biểu đồ đường số thao tác nhật ký trong 7 ngày">{[30, 75, 120].map(y => <line key={y} x1="30" x2="570" y1={y} y2={y} className="chart-gridline" />)}<polyline points={trendPoints} className="trend-line" />{auditTrend.map((value, index) => <g key={auditDays[index].key}><circle cx={30 + index * 90} cy={125 - value / trendMax * 95} r="4" className="trend-dot"><title>{auditDays[index].key}: {value} thao tác</title></circle><text x={30 + index * 90} y="145" textAnchor="middle" className="chart-axis-label">{auditDays[index].label}</text></g>)}</svg></div> : <Empty />}</section>}
      {can('poi.view') && <section className="panel"><h2>Địa điểm theo khu vực</h2>{data.zones.length ? <div className="bar-chart">{data.zones.map(zone => { const count = data.pois.filter(poi => poi.zone_id === zone.zone_id).length; return <div className="bar-row" key={zone.zone_id}><span title={zone.name}>{zone.name}</span><div className="bar-track"><i style={{ width: (count / maxZoneCount * 100) + '%' }} /></div><strong>{count}</strong></div> })}</div> : <Empty />}</section>}
      {can('poi.view') && <section className="panel"><h2>Nội dung & audio theo ngôn ngữ</h2>{localeRows.length ? <div className="bar-chart">{localeRows.map(language => <div className="locale-chart-row" key={language.code}><strong>{language.name}</strong><div><small>Nội dung</small><div className="bar-track"><i className="bar-text" style={{ width: (published.length ? language.withText / published.length * 100 : 0) + '%' }} /></div><small>{language.withText}/{published.length}</small></div><div><small>Audio</small><div className="bar-track"><i className="bar-audio" style={{ width: (published.length ? language.withAudio / published.length * 100 : 0) + '%' }} /></div><small>{language.withAudio}/{published.length}</small></div></div>)}</div> : <Empty text="Chưa có ngôn ngữ nào đang bật." />}</section>}
      {can('audio.view_tasks') && <section className="panel"><h2>Tác vụ audio</h2>{data.tasks.length ? <div className="bar-chart">{taskStatuses.map(([label, status]) => { const count = data.tasks.filter(task => task.status === status).length; return <div className="bar-row" key={status}><span>{label}</span><div className="bar-track"><i className={'task-bar task-' + status} style={{ width: (count / data.tasks.length * 100) + '%' }} /></div><strong>{count}</strong></div> })}</div> : <Empty text="Chưa có tác vụ audio." />}<button className="text-button" onClick={() => navigate('/audio-tasks')}>Mở danh sách tác vụ</button></section>}
</div>
{can('poi.view') && <section className="panel dashboard-pois"><div className="card-header"><h2>Địa điểm cập nhật gần đây</h2><button className="text-button" onClick={() => navigate('/pois')}>Xem tất cả →</button></div>{data.pois.length ? <div className="table-wrap"><table><thead><tr><th>Địa điểm</th><th>Khu vực</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead><tbody>{[...data.pois].sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()).slice(0, 5).map(poi => <tr key={poi.poi_id}><td><button className="text-button" onClick={() => navigate('/pois/' + poi.poi_id)}>{poi.content.vi?.name || Object.values(poi.content)[0]?.name || poi.poi_id}</button></td><td>{data.zones.find(zone => zone.zone_id === poi.zone_id)?.name || 'Chưa phân khu'}</td><td><Status value={poi.status} /></td><td>{dateLabel(poi.updated_at)}</td></tr>)}</tbody></table></div> : <Empty text="Chưa có địa điểm nào." />}</section>}
</div><aside className="dashboard-rail">
      {can('poi.view') && <section className="panel"><h2>Trạng thái địa điểm</h2>{data.pois.length ? <><div className="donut-layout"><svg viewBox="0 0 120 120" role="img" aria-label="Biểu đồ tròn trạng thái địa điểm"><circle cx="60" cy="60" r="43" fill="none" stroke="#e7ecea" strokeWidth="16" />{(() => { let offset = 0; const circumference = 270; return statusRows.map(([label, status, color]) => { const count = data.pois.filter(poi => poi.status === status).length; const length = count / data.pois.length * circumference; const segment = <circle key={status} cx="60" cy="60" r="43" fill="none" stroke={color} strokeWidth="16" strokeDasharray={length + ' ' + (circumference - length)} strokeDashoffset={-offset} transform="rotate(-90 60 60)"><title>{label}: {count}</title></circle>; offset += length; return segment }) })()}<text x="60" y="57" textAnchor="middle" className="donut-total">{data.pois.length}</text><text x="60" y="71" textAnchor="middle" className="donut-caption">địa điểm</text></svg><div className="chart-legend">{statusRows.map(([label, status, color]) => { const count = data.pois.filter(poi => poi.status === status).length; return <div key={status}><i style={{ background: color }} /><span>{label}</span><strong>{count}</strong></div> })}</div></div></> : <Empty />}</section>}
      <section className="panel"><h2>Cần xử lý</h2><div className="issue-list">{can('poi.view') && <button onClick={() => navigate('/pois?filter=missing-audio')}>POI thiếu audio <b>{missing.length} →</b></button>}{can('audio.view_tasks') && <button onClick={() => navigate('/audio-tasks')}>Tác vụ thất bại <b>{data.tasks.filter(task => task.status === 'failed').length} →</b></button>}</div></section>
      {can('user.view') && <section className="panel"><h2>Tài khoản</h2>{data.accounts.length ? <div className="bar-chart">{accountStatuses.map(([label, status]) => { const count = data.accounts.filter(account => account.status === status).length; return <div className="bar-row" key={status}><span>{label}</span><div className="bar-track"><i style={{ width: (count / data.accounts.length * 100) + '%' }} /></div><strong>{count}</strong></div> })}</div> : <Empty />}</section>}
</aside></div>
    {localDatabase && <details className="panel database-summary"><summary>Chi tiết dữ liệu hệ thống</summary><div className="card-header"><div><h2>Bảng dữ liệu MySQL</h2><p className="page-subtitle">Số bản ghi đang lưu trong tourism_db</p></div><strong>{Object.keys(tableCounts).length}/15</strong></div><div className="admin-kpis">{[['Người dùng', 'users'], ['Vai trò', 'roles'], ['Quyền', 'permissions'], ['Gán quyền vai trò', 'role_permissions'], ['Ngôn ngữ', 'languages'], ['Khu vực', 'zone'], ['POI', 'poi'], ['Nội dung POI', 'poi_content'], ['Audio tasks', 'audio_tasks'], ['Sự kiện analytics', 'analytics_events'], ['Mật độ theo giờ', 'poi_density_hourly'], ['Bản phát hành offline', 'offline_pack_releases'], ['Ngôn ngữ offline', 'offline_pack_languages'], ['Audit logs', 'audit_logs'], ['Phiên Admin', 'admin_sessions']].map(([label, table]) => <div className="mini-kpi" key={table}><span>{label}</span><strong>{tableCounts[table] ?? '—'}</strong></div>)}</div></details>}
</div>
}
function AuthPage({ activation = false }: { activation?: boolean }) {
  const { login, error } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const [token] = useState(() => new URLSearchParams(location.search).get('token') || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [name, setName] = useState('')

  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true)
    try {
      if (activation) {
        if (!token) throw new Error('Thiếu token lời mời. Hãy mở liên kết trong email.')
        if (password.length < 10 || !/\p{L}/u.test(password) || !/\d/.test(password) || password !== confirmation) throw new Error('Mật khẩu cần ít nhất 10 ký tự, có chữ và số; xác nhận phải trùng khớp.')
        await api('/auth/activate', { method: 'POST', body: JSON.stringify({ token, password, full_name: name }) }); setPassword(''); setConfirmation(''); setDone(true); navigate('/activate', { replace: true }); toast.success('Đã kích hoạt tài khoản. Bạn có thể đăng nhập.');
      } else { await login(username, password); setPassword(''); toast.success('Đăng nhập thành công.'); navigate('/') }
    } catch (reason) { toast.error((reason as Error).message) } finally { setPending(false) }
  }
  return <main className="auth-page"><div className="auth-layout"><section className="panel auth-card"><div className="auth-card-head"><span className="auth-icon"><MapPin size={23} /></span><p className="auth-eyebrow">MULTILINGUAL TOUR GUIDE</p><h1>{activation ? 'Kích hoạt tài khoản' : 'Chào mừng trở lại'}</h1><p>{activation ? 'Đặt mật khẩu để tiếp tục.' : 'Đăng nhập để vào bảng điều khiển quản trị.'}</p></div>{!done && <form className="admin-form auth-form" onSubmit={submit}>{activation ? <Field label="Họ và tên"><input required autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></Field> : <Field label="Tên đăng nhập"><input type="text" required minLength={3} maxLength={50} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Nhập tên đăng nhập" value={username} onChange={event => setUsername(event.target.value)} /></Field>}<Field label="Mật khẩu"><div className="auth-password"><input type={showPassword ? 'text' : 'password'} required minLength={activation ? 10 : undefined} autoComplete={activation ? 'new-password' : 'current-password'} placeholder={activation ? 'Tối thiểu 10 ký tự' : 'Nhập mật khẩu'} value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>{activation && <><p className="auth-hint">Mật khẩu cần ít nhất 10 ký tự, có chữ và số.</p><Field label="Nhập lại mật khẩu"><input type="password" required autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></Field></>}<button className="primary-button auth-submit" disabled={pending}>{pending ? 'Đang xử lý…' : activation ? 'Kích hoạt tài khoản' : 'Đăng nhập'}</button></form>}{error && <Notice>{error}</Notice>}{activation && <button className="text-button auth-secondary" onClick={() => navigate('/login')}>Quay lại đăng nhập</button>}</section></div></main>
}
function RoutedPage() {
  const { user, ready, can } = useAdmin()
  const path = useLocation().pathname.replace(/\/+$/, '') || '/'
  if (path === '/activate') return <AuthPage activation />
  if (!ready) return <Empty text="Đang kiểm tra phiên đăng nhập…" />
  if (!user) return path === '/login' ? <AuthPage /> : <Navigate to="/login" replace />
  if (path === '/login') return <Navigate to="/" replace />
  const entry = navigation.find(item => path === item.href || (item.href !== '/' && path.startsWith(item.href + '/')))
  let content: ReactNode = <Empty text="Trang không tồn tại." />
  if (entry?.permissions && !entry.permissions.some(can)) content = <Empty text="Bạn không có quyền truy cập trang này." />
  else if (path === '/') content = <Overview />
  else if (path === '/pois') content = <Pois />
  else if (/^\/pois\/[^/]+$/.test(path)) content = <PoiEditor key={path} id={path.split('/')[2]} />
  else if (path === '/zones') content = <Zones />
  else if (/^\/zones\/[^/]+(?:\/edit)?$/.test(path)) content = <ZoneEditor key={path} id={path.split('/')[2]} />
  else if (path === '/languages') content = <Languages />
  else if (path === '/roles') content = <Roles />
  else if (path === '/accounts') content = <Accounts />
  else if (path === '/audio-tasks') content = <AudioTasks />
  else if (path === '/offline-packs') content = <OfflinePacks />
  else if (path === '/audit-logs') content = <AuditLogs />
  else if (path === '/analytics') content = <Analytics />
  return <Shell title={entry?.label || 'Không tìm thấy'}><div key={`${user.role_id}:${path}`}>{content}</div></Shell>
}
export default function App() { return <AdminProvider><RoutedPage /></AdminProvider> }
