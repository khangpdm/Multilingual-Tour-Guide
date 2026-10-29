import './globals.css'
import './admin/admin.css'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, ChevronRight, FileAudio, Globe, LayoutDashboard, MapPin, Menu, Settings as SettingsIcon, ShieldCheck, Users, X } from 'lucide-react'
import { AdminProvider, dateLabel, poiName, roleNames, useAdmin, type Permission, type Role } from './admin/store'
import { Accounts, AudioTasks, AuditLogs, Languages, Roles } from './admin/Management'
import { PoiEditor, Pois, Settings, ZoneEditor, Zones } from './admin/Places'
import { Analytics } from './admin/Analytics'
import { DemoNotice, Empty, Heading, Notice } from './admin/ui'

const navigation: { label: string; href: string; icon: typeof MapPin; permission?: Permission }[] = [
  { label: 'Trang chủ', href: '/', icon: LayoutDashboard },
  { label: 'Địa điểm', href: '/pois', icon: MapPin, permission: 'poi.write' },
  { label: 'Khu vực', href: '/zones', icon: MapPin, permission: 'zone.write' },
  { label: 'Ngôn ngữ', href: '/languages', icon: Globe, permission: 'language.write' },
  { label: 'Tác vụ audio', href: '/audio-tasks', icon: FileAudio, permission: 'audio.write' },
  { label: 'Phân tích', href: '/analytics', icon: BarChart3, permission: 'analytics.read' },
  { label: 'Tài khoản', href: '/accounts', icon: Users, permission: 'account.write' },
  { label: 'Vai trò & quyền', href: '/roles', icon: ShieldCheck, permission: 'role.write' },
  { label: 'Nhật ký thao tác', href: '/audit-logs', icon: Activity, permission: 'audit.read' },
  { label: 'Cấu hình', href: '/settings', icon: SettingsIcon, permission: 'poi.write' },
]

function Shell({ children, title }: { children: ReactNode; title: string }) {
  const { role, setRole, can, data } = useAdmin()
  const navigate = useNavigate()
  const path = useLocation().pathname
  const [open, setOpen] = useState(false)
  return <div className="app-shell"><aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><div className="brand-mark"><MapPin size={18} fill="currentColor" /></div><span>thuyết minh</span><button className="mobile-close" aria-label="Đóng menu" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="workspace-switcher"><div className="workspace-avatar">AA</div><div><p>Auto Audio Guide</p><span>Không gian quản trị</span></div></div><nav className="nav-list"><p className="nav-caption">ĐIỀU HƯỚNG</p>{navigation.filter(item => !item.permission || can(item.permission)).map(({ label, href, icon: Icon }) => {
    const active = path === href || (href !== '/' && path.startsWith(href + '/'))
    return <button key={href} aria-current={active ? 'page' : undefined} className={`nav-item ${active ? 'nav-active' : ''}`} onClick={() => { navigate(href); setOpen(false) }}><Icon size={18} /><span>{label}</span>{href === '/pois' && <span className="nav-count">{data.pois.length}</span>}</button>
  })}</nav><div className="sidebar-bottom"><div className="profile-row"><div className="profile-avatar">NA</div><div><p>Nguyễn An · Demo</p><span>{role}</span></div></div></div></aside>{open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Đóng menu" />}<button className="menu-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={21} /></button><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-actions"><select className="role-switch" value={role} onChange={event => { setRole(event.target.value as Role); setOpen(false) }} aria-label="Chuyển vai trò demo">{roleNames.map(item => <option key={item}>{item}</option>)}</select><div className="user-chip"><div className="profile-avatar small">NA</div></div></div></header><div className="page-body admin-page"><DemoNotice />{children}</div></main></div>
}

function Overview() {
  const { data, can } = useAdmin()
  const navigate = useNavigate()
  const activeLanguages = data.languages.filter(language => language.is_active)
  const missing = data.pois.filter(poi => activeLanguages.some(language => !poi.contents.some(content => content.language_code === language.code && content.audio_url)))
  const listens = data.events.filter(event => event.event_type === 'AUDIO_PLAY')
  const dayKeys = Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - 13 + index); return date.toLocaleDateString('vi-VN') })
  const daily = dayKeys.map(day => listens.filter(event => new Date(event.occurred_at).toLocaleDateString('vi-VN') === day).length)
  const max = Math.max(1, ...daily)
  const points = daily.map((count, index) => `${index * 50},${180 - count / max * 150}`).join(' ')
  return <><Heading title="Tổng quan workspace" detail="Chỉ số tính từ cùng dữ liệu demo với các màn hình quản trị." /><div className="admin-kpis">{[['Địa điểm', data.pois.length], ['Khu vực', data.zones.length], ['Ngôn ngữ hoạt động', activeLanguages.length], ['POI thiếu audio', missing.length]].map(([label, count]) => <section className="panel mini-kpi" key={label}><span>{label}</span><strong>{count}</strong></section>)}</div>{can('analytics.read') && <div className="legacy-home-grid"><section className="panel listening-chart-card"><div className="card-header"><div><h2>Xu hướng lượt nghe</h2><p className="page-subtitle">14 ngày gần nhất · Dữ liệu mẫu</p></div><strong>{daily.reduce((total, count) => total + count, 0)} lượt</strong></div><div className="line-chart-wrap"><svg viewBox="0 0 650 200" role="img" aria-label={`Lượt nghe từng ngày: ${daily.join(', ')}`}><polyline points={points} className="current-line" fill="none" />{daily.map((count, index) => <circle key={index} cx={index * 50} cy={180 - count / max * 150} r="4" fill="var(--primary)"><title>{dayKeys[index]}: {count} lượt nghe</title></circle>)}</svg><div className="chart-x"><span>{dayKeys[0]}</span><span>{dayKeys[13]}</span></div></div></section><section className="panel"><h2>Ngôn ngữ được nghe</h2><div className="language-list">{data.languages.map(language => { const count = listens.filter(event => event.language_code === language.code).length; return <div key={language.code}><span>{language.native_name}</span><strong>{count} lượt · {listens.length ? Math.round(count / listens.length * 100) : 0}%</strong></div> })}</div><button className="text-button" onClick={() => navigate('/analytics')}>Xem phân tích →</button></section></div>}<div className="lower-grid"><section className="panel"><h2>Cần xử lý</h2><div className="issue-list">{can('poi.write') && <button onClick={() => navigate('/pois?filter=missing-audio')}>POI thiếu audio <b>{missing.length} →</b></button>}{can('audio.write') && <button onClick={() => navigate('/audio-tasks')}>Tác vụ thất bại <b>{data.tasks.filter(task => task.state === 'FAILED').length} →</b></button>}</div>{!can('poi.write') && !can('audio.write') && <Empty text="Không có tác vụ quản trị cho vai trò này." />}</section><section className="panel"><h2>Hoạt động gần đây</h2>{can('audit.read') ? <>{data.audit.slice(0, 5).map(log => <div className="activity-item" key={log.id}><div className="activity-icon teal"><Activity size={16} /></div><div><strong>{log.action}</strong><span>{dateLabel(log.created_at)} · {log.actor_role}</span></div></div>)}{!data.audit.length && <Empty text="Chưa có thay đổi đã lưu." />}</> : <Empty text="Bạn không có quyền xem nhật ký." />}</section></div></>
}

function AuthPage() {
  const navigate = useNavigate()
  return <main className="auth-page"><section className="panel auth-card"><div className="auth-brand"><MapPin size={24} /><strong>thuyết minh</strong></div><h1>Workspace quản trị</h1><Notice>Đây là bản demo giao diện. Chưa kết nối đăng nhập, OTP hoặc email khôi phục; không nhập mật khẩu thật.</Notice><button className="primary-button" onClick={() => navigate('/')}>Mở workspace demo</button></section></main>
}

function RoutedPage() {
  const { can, role } = useAdmin()
  const { pathname } = useLocation()
  const path = pathname.replace(/\/+$/, '') || '/'
  if (['/login', '/verify-otp', '/forgot-password', '/reset-password', '/set-password'].includes(path)) return <AuthPage />
  const entry = navigation.find(item => path === item.href || (item.href !== '/' && path.startsWith(item.href + '/')))
  let content: ReactNode
  if (entry?.permission && !can(entry.permission)) content = <section className="panel"><ShieldCheck size={32} /><h1>Không có quyền truy cập</h1><p>Vai trò hiện tại không được mở trang này. Bạn có thể chuyển vai trò demo ở thanh trên.</p></section>
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
  else if (path === '/settings') content = <Settings />
  else content = <Empty text="Trang không tồn tại. Chọn một mục trong menu để tiếp tục." />
  return <Shell title={entry?.label ?? 'Không tìm thấy'}><div key={`${role}:${path}`}>{content}</div></Shell>
}

export default function App() { return <AdminProvider><RoutedPage /></AdminProvider> }
