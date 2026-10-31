import './globals.css'
import './admin/admin.css'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, ChevronRight, FileAudio, Globe, LayoutDashboard, Eye, EyeOff, MapPin, Menu, ShieldCheck, Users, X } from 'lucide-react'
import { AdminProvider, api, dateLabel, useAdmin, type Permission } from './admin/store'
import { Accounts, AudioTasks, AuditLogs, Languages, Roles } from './admin/Management'
import { PoiEditor, Pois, ZoneEditor, Zones } from './admin/Places'
import { Analytics } from './admin/Analytics'
import { DemoNotice, Empty, Field, Heading, Notice } from './admin/ui'

const navigation: { label: string; href: string; icon: typeof MapPin; permissions?: Permission[] }[] = [
  { label: 'Trang chủ', href: '/', icon: LayoutDashboard },
  { label: 'Địa điểm', href: '/pois', icon: MapPin, permissions: ['poi.view'] },
  { label: 'Khu vực', href: '/zones', icon: MapPin, permissions: ['poi.view'] },
  { label: 'Ngôn ngữ', href: '/languages', icon: Globe, permissions: ['poi.view'] },
  { label: 'Tác vụ audio', href: '/audio-tasks', icon: FileAudio, permissions: ['audio.view_tasks'] },
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
  const [message, setMessage] = useState('')
  return <div className="app-shell"><aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><div className="brand-mark"><MapPin size={18} /></div><span>Multilingual Tour Guide</span><button className="mobile-close" aria-label="Đóng menu" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="workspace-switcher"><div className="workspace-avatar">MT</div><div><p>Multilingual Tour Guide</p><span>Không gian quản trị</span></div></div><nav className="nav-list"><p className="nav-caption">ĐIỀU HƯỚNG</p>{navigation.filter(item => !item.permissions || item.permissions.some(can)).map(({ label, href, icon: Icon }) => <button key={href} aria-current={path === href ? 'page' : undefined} className={`nav-item ${path === href || (href !== '/' && path.startsWith(href + '/')) ? 'nav-active' : ''}`} onClick={() => { navigate(href); setOpen(false) }}><Icon size={18} /><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><div className="profile-row"><div className="profile-avatar">{user?.full_name?.slice(0, 1) || 'A'}</div><div><p>{user?.full_name || user?.email}</p><span>{user?.role_id}</span></div></div><button className="text-button" disabled={busy} onClick={() => { void logout().then(() => navigate('/login')).catch(reason => setMessage(reason.message)) }}>Đăng xuất</button></div></aside>{open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Đóng menu" />}<button className="menu-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={21} /></button><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-actions">{mode === 'demo' ? <select className="role-switch" disabled={busy} value={user?.role_id} onChange={event => switchRole(event.target.value)} aria-label="Vai trò demo">{data.roles.filter(role => role.role_id !== 'user').map(role => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select> : <button className="secondary-button" disabled={busy} onClick={() => void reload()}>{busy ? 'Đang tải…' : 'Tải lại dữ liệu'}</button>}</div></header><div className="page-body admin-page"><DemoNotice />{message && <Notice>{message}</Notice>}{children}</div></main></div>
}
function Overview() {
  const { data, can } = useAdmin()
  const navigate = useNavigate()
  const published = data.pois.filter(poi => poi.status === 'published')
  const missing = published.filter(poi => data.languages.some(language => language.is_active && !poi.content[language.code]?.audio_url))
  const statusRows = [['Công khai', 'published', '#21816f'], ['Chưa công khai', 'unpublished', '#d59b36'], ['Đã lưu trữ', 'archived', '#83929a']] as const
  const localeRows = data.languages.filter(language => language.is_active).map(language => ({ ...language, withText: published.filter(poi => Boolean(poi.content[language.code]?.text?.trim())).length, withAudio: published.filter(poi => Boolean(poi.content[language.code]?.audio_url)).length }))
  const taskStatuses = [['Đang chờ', 'queued'], ['Đang xử lý', 'processing'], ['Hoàn tất', 'completed'], ['Thất bại', 'failed'], ['Đã hủy', 'cancelled']] as const
  const accountStatuses = [['Đang hoạt động', 'active'], ['Chờ kích hoạt', 'pending_activation'], ['Đã vô hiệu hóa', 'deactivated']] as const
  const maxZoneCount = Math.max(1, ...data.zones.map(zone => data.pois.filter(poi => poi.zone_id === zone.zone_id).length))
  const auditDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return { key: date.toLocaleDateString('sv-SE'), label: date.toLocaleDateString('vi-VN', { weekday: 'short' }) } })
  const auditTrend = auditDays.map(day => data.audit.filter(log => new Date(log.timestamp).toLocaleDateString('sv-SE') === day.key).length)
  const trendMax = Math.max(1, ...auditTrend)
  const trendPoints = auditTrend.map((value, index) => (30 + index * 90) + ',' + (125 - value / trendMax * 95)).join(' ')
  return <><Heading title="Tổng quan workspace" detail="Quản lý nội dung đa ngôn ngữ, audio và chất lượng dữ liệu." />
    {can('poi.view') && <div className="admin-kpis">{[['Tổng POI', data.pois.length], ['POI công khai', published.length], ['Khu vực', data.zones.length], ['Ngôn ngữ đang bật', data.languages.filter(language => language.is_active).length]].map(([label, value]) => <section className="panel mini-kpi" key={label}><span>{label}</span><strong>{value}</strong></section>)}</div>}
    <div className="dashboard-grid">
      {can('poi.view') && <section className="panel"><h2>Trạng thái địa điểm</h2>{data.pois.length ? <><div className="donut-layout"><svg viewBox="0 0 120 120" role="img" aria-label="Biểu đồ tròn trạng thái địa điểm"><circle cx="60" cy="60" r="43" fill="none" stroke="#e7ecea" strokeWidth="16" />{(() => { let offset = 0; const circumference = 270; return statusRows.map(([label, status, color]) => { const count = data.pois.filter(poi => poi.status === status).length; const length = count / data.pois.length * circumference; const segment = <circle key={status} cx="60" cy="60" r="43" fill="none" stroke={color} strokeWidth="16" strokeDasharray={length + ' ' + (circumference - length)} strokeDashoffset={-offset} transform="rotate(-90 60 60)"><title>{label}: {count}</title></circle>; offset += length; return segment }) })()}<text x="60" y="57" textAnchor="middle" className="donut-total">{data.pois.length}</text><text x="60" y="71" textAnchor="middle" className="donut-caption">địa điểm</text></svg><div className="chart-legend">{statusRows.map(([label, status, color]) => { const count = data.pois.filter(poi => poi.status === status).length; return <div key={status}><i style={{ background: color }} /><span>{label}</span><strong>{count}</strong></div> })}</div></div></> : <Empty />}</section>}
      {can('poi.view') && <section className="panel"><h2>Địa điểm theo khu vực</h2>{data.zones.length ? <div className="bar-chart">{data.zones.map(zone => { const count = data.pois.filter(poi => poi.zone_id === zone.zone_id).length; return <div className="bar-row" key={zone.zone_id}><span title={zone.name}>{zone.name}</span><div className="bar-track"><i style={{ width: (count / maxZoneCount * 100) + '%' }} /></div><strong>{count}</strong></div> })}</div> : <Empty />}</section>}
      {can('poi.view') && <section className="panel"><h2>Nội dung & audio theo ngôn ngữ</h2>{localeRows.length ? <div className="bar-chart">{localeRows.map(language => <div className="locale-chart-row" key={language.code}><strong>{language.name}</strong><div><small>Nội dung</small><div className="bar-track"><i className="bar-text" style={{ width: (published.length ? language.withText / published.length * 100 : 0) + '%' }} /></div><small>{language.withText}/{published.length}</small></div><div><small>Audio</small><div className="bar-track"><i className="bar-audio" style={{ width: (published.length ? language.withAudio / published.length * 100 : 0) + '%' }} /></div><small>{language.withAudio}/{published.length}</small></div></div>)}</div> : <Empty text="Chưa có ngôn ngữ nào đang bật." />}</section>}
      {can('audio.view_tasks') && <section className="panel"><h2>Tác vụ audio</h2>{data.tasks.length ? <div className="bar-chart">{taskStatuses.map(([label, status]) => { const count = data.tasks.filter(task => task.status === status).length; return <div className="bar-row" key={status}><span>{label}</span><div className="bar-track"><i className={'task-bar task-' + status} style={{ width: (count / data.tasks.length * 100) + '%' }} /></div><strong>{count}</strong></div> })}</div> : <Empty text="Chưa có tác vụ audio." />}<button className="text-button" onClick={() => navigate('/audio-tasks')}>Mở danh sách tác vụ</button></section>}
      {can('user.view') && <section className="panel"><h2>Tài khoản</h2>{data.accounts.length ? <div className="bar-chart">{accountStatuses.map(([label, status]) => { const count = data.accounts.filter(account => account.status === status).length; return <div className="bar-row" key={status}><span>{label}</span><div className="bar-track"><i style={{ width: (count / data.accounts.length * 100) + '%' }} /></div><strong>{count}</strong></div> })}</div> : <Empty />}</section>}
      {can('audit.view') && <section className="panel"><h2>Hoạt động 7 ngày gần đây</h2>{data.audit.length ? <div className="line-chart"><svg viewBox="0 0 620 150" role="img" aria-label="Biểu đồ đường số thao tác nhật ký trong 7 ngày">{[30, 75, 120].map(y => <line key={y} x1="30" x2="570" y1={y} y2={y} className="chart-gridline" />)}<polyline points={trendPoints} className="trend-line" />{auditTrend.map((value, index) => <g key={auditDays[index].key}><circle cx={30 + index * 90} cy={125 - value / trendMax * 95} r="4" className="trend-dot"><title>{auditDays[index].key}: {value} thao tác</title></circle><text x={30 + index * 90} y="145" textAnchor="middle" className="chart-axis-label">{auditDays[index].label}</text></g>)}</svg></div> : <Empty />}</section>}
      <section className="panel"><h2>Cần xử lý</h2><div className="issue-list">{can('poi.view') && <button onClick={() => navigate('/pois?filter=missing-audio')}>POI thiếu audio <b>{missing.length} →</b></button>}{can('audio.view_tasks') && <button onClick={() => navigate('/audio-tasks')}>Tác vụ thất bại <b>{data.tasks.filter(task => task.status === 'failed').length} →</b></button>}</div></section>
    </div></>
}
function AuthPage({ activation = false }: { activation?: boolean }) {
  const { login, enterDemo, error } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const [token] = useState(() => new URLSearchParams(location.search).get('token') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(''); setPending(true)
    try {
      if (activation) {
        if (!token) throw new Error('Thiếu token lời mời. Hãy mở liên kết trong email.')
        if (password.length < 10 || !/\p{L}/u.test(password) || !/\d/.test(password) || password !== confirmation) throw new Error('Mật khẩu cần ít nhất 10 ký tự, có chữ và số; xác nhận phải trùng khớp.')
        await api('/auth/activate', { method: 'POST', body: JSON.stringify({ token, password, full_name: name }) }); setPassword(''); setConfirmation(''); setDone(true); navigate('/activate', { replace: true }); setMessage('Đã kích hoạt tài khoản. Bạn có thể đăng nhập.');
      } else { await login(email, password); setPassword(''); navigate('/') }
    } catch (reason) { setMessage((reason as Error).message) } finally { setPending(false) }
  }
  return <main className="auth-page"><div className="auth-layout"><section className="auth-story"><div className="auth-brand"><span className="auth-brand-mark"><MapPin size={19} /></span><strong>Multilingual Tour Guide</strong></div><div className="auth-story-copy"><p className="auth-eyebrow">MULTILINGUAL TOUR GUIDE · ADMIN</p><h2>{activation ? 'Hoàn tất thiết lập tài khoản' : 'Mọi điểm đến, trong một trải nghiệm.'}</h2><p>{activation ? 'Tạo thông tin đăng nhập để bắt đầu quản lý nội dung và ngôn ngữ.' : 'Quản lý địa điểm, nội dung đa ngôn ngữ và thuyết minh audio từ một không gian duy nhất.'}</p></div><div className="auth-story-footer"><span>◉ &nbsp; Tiếng Việt</span><span>Không gian quản trị</span></div></section><section className="panel auth-card"><div className="auth-card-head"><span className="auth-icon"><ShieldCheck size={18} /></span><p className="auth-eyebrow">CHÀO MỪNG BẠN</p><h1>{activation ? 'Kích hoạt tài khoản' : 'Đăng nhập'}</h1><p>{activation ? 'Đặt mật khẩu để tiếp tục.' : 'Đăng nhập để vào bảng điều khiển quản trị.'}</p></div>{!done && <form className="admin-form auth-form" onSubmit={submit}>{activation ? <Field label="Họ và tên"><input required autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></Field> : <Field label="Email"><input type="email" required autoComplete="username" placeholder="ten@congty.com" value={email} onChange={event => setEmail(event.target.value)} /></Field>}<Field label="Mật khẩu"><div className="auth-password"><input type={showPassword ? 'text' : 'password'} required minLength={activation ? 10 : undefined} autoComplete={activation ? 'new-password' : 'current-password'} placeholder={activation ? 'Tối thiểu 10 ký tự' : 'Nhập mật khẩu'} value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>{activation && <><p className="auth-hint">Mật khẩu cần ít nhất 10 ký tự, có chữ và số.</p><Field label="Nhập lại mật khẩu"><input type="password" required autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></Field></>}<button className="primary-button auth-submit" disabled={pending}>{pending ? 'Đang xử lý…' : activation ? 'Kích hoạt tài khoản' : 'Đăng nhập'}</button></form>}{(message || error) && <Notice>{message || error}</Notice>}{activation ? <button className="text-button auth-secondary" onClick={() => navigate('/login')}>Quay lại đăng nhập</button> : <><div className="auth-divider"><span>hoặc</span></div><button className="secondary-button auth-secondary" onClick={() => { enterDemo(); navigate('/') }}>Vào xem thử giao diện</button></>}</section></div></main>
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
  else if (path === '/audit-logs') content = <AuditLogs />
  else if (path === '/analytics') content = <Analytics />
  return <Shell title={entry?.label || 'Không tìm thấy'}><div key={`${user.role_id}:${path}`}>{content}</div></Shell>
}
export default function App() { return <AdminProvider><RoutedPage /></AdminProvider> }
