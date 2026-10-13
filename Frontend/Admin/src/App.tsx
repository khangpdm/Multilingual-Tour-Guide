'use client'

import './globals.css'

import { useMemo, useState } from 'react'
import { BrowserRouter, MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, Archive, BarChart3, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, FileAudio, FolderKanban, Headphones, Image as ImageIcon, LayoutDashboard, LockKeyhole, Map, MapPin, Menu, MoreHorizontal, PackageCheck, Plus, QrCode, RotateCcw, Search, Settings, ShieldCheck, SlidersHorizontal, Upload, UserRound, Users, X } from 'lucide-react'

type Role = 'POI Manager' | 'Admin' | 'Super Admin'
const zones = ['Hà Nội cổ', 'Trung tâm Sài Gòn', 'Di sản miền Trung']
const poiSeed = ['Văn Miếu - Quốc Tử Giám', 'Dinh Độc Lập', 'Phố cổ Hội An', 'Hoàng thành Thăng Long', 'Cầu Rồng Đà Nẵng', 'Bưu điện Trung tâm Sài Gòn', 'Chùa Cầu', 'Nhà hát Lớn Hà Nội', 'Bảo tàng Chăm', 'Chợ Bến Thành', 'Lăng Khải Định', 'Hồ Hoàn Kiếm']
const roles: Role[] = ['POI Manager', 'Admin', 'Super Admin']

function Badge({ children, tone = 'ready' }: { children: React.ReactNode; tone?: 'ready' | 'warn' | 'danger' | 'neutral' }) { return <span className={`status-badge badge-${tone}`}><i />{children}</span> }
function Button({ children, primary = false, onClick, disabled = false }: { children: React.ReactNode; primary?: boolean; onClick?: () => void; disabled?: boolean }) { return <button disabled={disabled} onClick={onClick} className={primary ? 'primary-button' : 'secondary-button'}>{children}</button> }
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`panel ${className}`}>{children}</section> }
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label> }

function AuthPage({ mode }: { mode: string }) {
  const navigate = useNavigate(); const [loading, setLoading] = useState(false); const [email, setEmail] = useState('admin@auto-audio.demo')
  const title = mode === 'login' ? 'Đăng nhập workspace' : mode === 'verify-otp' ? 'Xác minh Super Admin' : mode === 'forgot-password' ? 'Quên mật khẩu' : mode === 'set-password' ? 'Thiết lập mật khẩu' : 'Đặt lại mật khẩu'
  return <main className="auth-page"><div className="auth-brand"><div className="brand-mark"><MapPin size={19} fill="currentColor" /></div><strong>thuyết minh</strong></div><Card className="auth-card"><div className="auth-icon"><LockKeyhole size={21} /></div><h1>{title}</h1><p className="page-subtitle">{mode === 'login' ? 'Quản trị nội dung thuyết minh du lịch tự động.' : 'Đây là prototype demo, không gửi email hoặc OTP thật.'}</p>{mode === 'login' && <><Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} type="email" /></Field><Field label="Mật khẩu"><input type="password" defaultValue="demo1234" /></Field><Button primary onClick={() => { setLoading(true); setTimeout(() => navigate('/'), 350) }}>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</Button><button className="link-button" onClick={() => navigate('/forgot-password')}>Quên mật khẩu?</button></>}{mode === 'verify-otp' && <><Field label="Mã OTP 6 chữ số"><input inputMode="numeric" maxLength={6} placeholder="000000" /></Field><p className="otp-timer">Mã còn hiệu lực 04:32 · tối đa 3 lần thử</p><Button primary onClick={() => navigate('/')}>Xác minh</Button></>}{mode === 'forgot-password' && <><Field label="Email tài khoản"><input value={email} onChange={e => setEmail(e.target.value)} type="email" /></Field><Button primary onClick={() => navigate('/login')}>Gửi hướng dẫn</Button></>}{['reset-password', 'set-password'].includes(mode) && <><Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự, gồm chữ và số"><input type="password" /></Field><Field label="Xác nhận mật khẩu"><input type="password" /></Field><Button primary onClick={() => navigate('/login')}>Lưu mật khẩu</Button></>}<button className="back-link" onClick={() => navigate('/login')}><ChevronLeft size={15} /> Quay lại đăng nhập</button></Card><small className="demo-note">Dữ liệu demo · Auto Audio Guide</small></main>
}

function Sidebar({ role, setRole }: { role: Role; setRole: (r: Role) => void }) { const navigate = useNavigate(); const path = useLocation().pathname; const [open, setOpen] = useState(false); const items = [{ label: 'Trang chủ', href: '/', icon: LayoutDashboard }, { label: 'Địa điểm', href: '/pois', icon: MapPin }, { label: 'Khu vực & Offline Pack', href: '/zones', icon: PackageCheck }, { label: 'Phân tích', href: '/analytics', icon: BarChart3 }, ...(role === 'Super Admin' ? [{ label: 'Tài khoản', href: '/accounts', icon: Users }] : []), ...((role !== 'POI Manager') ? [{ label: 'Cấu hình', href: '/settings', icon: Settings }] : [])]; return <><aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><div className="brand-mark"><MapPin size={18} fill="currentColor" /></div><span>thuyết minh</span><button className="mobile-close" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="workspace-switcher"><div className="workspace-avatar">AA</div><div><p>Auto Audio Guide</p><span>Không gian quản trị</span></div></div><nav className="nav-list"><p className="nav-caption">ĐIỀU HƯỚNG</p>{items.map(({ label, href, icon: Icon }) => <button key={href} aria-current={path === href || (href !== '/' && path.startsWith(href)) ? 'page' : undefined} className={`nav-item ${path === href || (href !== '/' && path.startsWith(href)) ? 'nav-active' : ''}`} onClick={() => { navigate(href); setOpen(false) }}><Icon size={18} /><span>{label}</span>{label === 'Địa điểm' && <span className="nav-count">12</span>}</button>)}</nav><div className="sidebar-bottom"><div className="profile-row"><div className="profile-avatar">NA</div><div><p>Nguyễn An</p><span>{role}</span></div></div></div></aside>{open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Đóng menu" />}<button className="menu-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={21} /></button></> }
function Shell({ role, setRole, children, title }: { role: Role; setRole: (r: Role) => void; children: React.ReactNode; title: string }) { return <div className="app-shell"><Sidebar role={role} setRole={setRole} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-actions"><select className="role-switch" value={role} onChange={e => setRole(e.target.value as Role)} aria-label="Chuyển vai trò">{roles.map(r => <option key={r}>{r}</option>)}</select><button className="icon-button"><Bell size={19} /></button><div className="user-chip"><div className="profile-avatar small">NA</div><div className="hidden sm:block"><p>Nguyễn An</p><span>{role}</span></div></div></div></header><div className="page-body">{children}</div></main></div> }
function PageHeading({ eyebrow = 'AUTO AUDIO GUIDE', title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: React.ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div><div className="heading-actions">{children}</div></div> }

const listeningData = [420, 560, 510, 680, 610, 770, 720, 860, 830, 940, 890, 1010, 980, 1120, 1080, 1190, 1260, 1210, 1360, 1310, 1450, 1410, 1540, 1490, 1630, 1580, 1710, 1680, 1820, 1760]
const previousListeningData = [390, 470, 450, 540, 520, 590, 620, 680, 650, 730, 710, 790, 760, 840, 810, 900, 860, 950, 910, 1000, 970, 1050, 1010, 1110, 1070, 1160, 1120, 1210, 1190, 1280]
function ListeningChart() { const [range, setRange] = useState('30 ngày'); const points = range === '7 ngày' ? listeningData.slice(-7) : range === '90 ngày' ? listeningData.map((v, i) => v - (i % 5) * 25) : listeningData; const previous = range === '7 ngày' ? previousListeningData.slice(-7) : range === '90 ngày' ? previousListeningData.map((v, i) => v - (i % 4) * 18) : previousListeningData; const max = Math.max(...points, ...previous); const width = 760; const height = 230; const line = (values: number[]) => values.map((v, i) => `${(i / (values.length - 1)) * width},${height - (v / max) * 185 - 15}`).join(' '); const area = `${line(points)} ${width},${height} 0,${height}`; return <Card className="listening-chart-card"><div className="card-header"><div><h2>Xu hướng lượt nghe</h2><p><strong className="chart-total">18.426</strong> lượt nghe · <span className="positive-change">+12,8%</span> so kỳ trước</p></div><select className="select-control" value={range} onChange={e => setRange(e.target.value)} aria-label="Khoảng thời gian lượt nghe"><option>7 ngày</option><option>30 ngày</option><option>90 ngày</option></select></div><div className="line-chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Biểu đồ xu hướng lượt nghe ${range}`}><defs><linearGradient id="listening-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#247c7a" stopOpacity=".22" /><stop offset="100%" stopColor="#247c7a" stopOpacity="0" /></linearGradient></defs>{[0,1,2,3].map(i => <line key={i} x1="0" x2={width} y1={15 + i * 61} y2={15 + i * 61} className="chart-grid-line" />)}<polygon points={area} fill="url(#listening-area)" /><polyline points={line(previous)} className="previous-line" fill="none" /><polyline points={line(points)} className="current-line" fill="none" /></svg><div className="chart-x"><span>14/09</span><span>24/09</span><span>04/10</span><span>13/10</span></div></div><div className="chart-legend"><span><i className="legend-current" /> Kỳ này</span><span><i className="legend-previous" /> Kỳ trước</span><small>Cập nhật 5 phút trước · GMT+7</small></div></Card> }
function ListeningHeatmap() { const today = new Date(2026, 9, 13); const cells = Array.from({ length: 364 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - (363 - i)); const value = (i * 37 + (i % 7) * 41) % 220; return { date: d, value, level: value === 0 ? 0 : value < 65 ? 1 : value < 130 ? 2 : value < 185 ? 3 : 4 } }); const total = cells.reduce((sum, cell) => sum + cell.value, 0); const active = cells.filter(cell => cell.value > 0).length; const peak = cells.reduce((a, b) => a.value > b.value ? a : b); const formatDate = (date: Date) => date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); return <Card className="activity-card"><div className="card-header"><div><h2>Hoạt động nghe thuyết minh</h2><p>12 tháng gần nhất · ngày tham chiếu 13/10/2026 · GMT+7</p></div><Activity size={20} color="var(--primary)" /></div><div className="heat-summary"><strong>{total.toLocaleString('vi-VN')} lượt nghe</strong><span>{active} ngày có hoạt động</span><span>Cao nhất: {formatDate(peak.date)}</span></div><div className="heatmap-scroll"><div className="heatmap-board"><div className="heat-week-labels"><span>T2</span><span>T4</span><span>T6</span></div><div className="heat-grid">{cells.map(cell => <button key={cell.date.toISOString()} className={`heat-cell heat-${cell.level}`} title={`${formatDate(cell.date)} — ${cell.value} lượt nghe`} aria-label={`${formatDate(cell.date)} — ${cell.value} lượt nghe`} />)}</div></div></div><div className="heat-legend"><span>Ít</span><i className="heat-0" /><i className="heat-1" /><i className="heat-2" /><i className="heat-3" /><i className="heat-4" /><span>Nhiều</span></div></Card> }







function ListeningTrendChart() {
  const [range, setRange] = useState("Monthly");
  return (
    <Card className="chart-card">
      <div className="card-header">
        <div>
          <h2>Students Participation</h2>
          <p style={{fontSize: "11px", color: "var(--muted-foreground)"}}>Xu hướng lượt nghe theo thời gian</p>
        </div>
        <div style={{display: "flex", gap: "6px", alignItems: "center", fontSize: "12px", color: "var(--muted-foreground)"}}>
          <span>Show:</span>
          <span style={{color: "var(--primary)", fontWeight: "700", cursor: "pointer"}}>Monthly ▾</span>
        </div>
      </div>
      <div style={{position: "relative", height: "230px", padding: "10px 10px 0"}}>
        {/* Y-Axis Grid & Labels */}
        <div style={{position: "absolute", left: "10px", right: "10px", top: "10px", bottom: "35px", display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none"}}>
          {[200, 150, 100, 50, 0].map(val => (
            <div key={val} style={{display: "flex", alignItems: "center", width: "100%"}}>
              <span style={{width: "30px", fontSize: "10px", color: "var(--muted-foreground)", textAlign: "right", paddingRight: "8px"}}>{val}</span>
              <div style={{flex: 1, borderBottom: "1px dashed #e2e8f0"}} />
            </div>
          ))}
        </div>

        {/* SVG Curve */}
        <svg viewBox="0 0 540 160" style={{position: "absolute", left: "45px", right: "15px", top: "15px", height: "135px", overflow: "visible"}}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d="M 0 120 C 80 80, 120 140, 200 40 C 280 -20, 320 130, 420 50 C 470 20, 500 50, 540 45 L 540 160 L 0 160 Z" fill="url(#chartGrad)" />
          <path d="M 0 120 C 80 80, 120 140, 200 40 C 280 -20, 320 130, 420 50 C 470 20, 500 50, 540 45" fill="none" stroke="#10b981" strokeWidth="2.5" />
          
          {/* Tooltip Hover point at x=420 */}
          <line x1="420" y1="0" x2="420" y2="160" stroke="#64748b" strokeWidth="1" />
          <circle cx="420" cy="50" r="5" fill="#fff" stroke="#10b981" strokeWidth="2.5" />
          <g transform="translate(435, 30)">
            <rect x="0" y="0" width="48" height="26" rx="13" fill="#475569" />
            <text x="24" y="17" fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle">125</text>
          </g>
        </svg>

        {/* X-Axis Labels */}
        <div style={{position: "absolute", left: "50px", right: "15px", bottom: "5px", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted-foreground)"}}>
          <span>1 Dec</span>
          <span>8 Dec</span>
          <span>16 Dec</span>
          <span>31 Dec</span>
        </div>
      </div>
    </Card>
  );
}
function ListeningContributionHeatmap() {
  const monthNames = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMondayOffset = (today.getDay() + 6) % 7;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364 - currentMondayOffset);
  const totalWeeks = 53;
  const monthColumns = Array.from({ length: totalWeeks }, (_, week) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + week * 7);
    return date.getDate() <= 7 ? monthNames[date.getMonth()] : "";
  });
  
  return (
    <Card className="chart-card" style={{gridColumn: "1 / -1", width: "100%"}}>
      <div className="card-header" style={{alignItems: "center"}}>
        <div>
          <h2>Lượt nghe</h2>
          <p className="page-subtitle">Lượt nghe thuyết minh tự động theo thời gian</p>
        </div>
        <span className="page-subtitle">12 tháng gần nhất</span>
      </div>

      <div style={{background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", marginTop: "16px", boxShadow: "0 2px 8px rgba(32, 91, 84, 0.04)"}}>
        <div style={{display: "grid", gridTemplateColumns: `35px repeat(${totalWeeks}, minmax(0, 1fr))`, gap: "4px", width: "100%", marginBottom: "10px", paddingLeft: "6px", fontSize: "11px", color: "var(--muted-foreground)"}}>
          <span />
          {monthColumns.map((month, i) => <span key={`${month}-${i}`} style={{whiteSpace: "nowrap", overflow: "visible", textAlign: "center"}}>{month}</span>)}
        </div>
        <div style={{display: "flex", gap: "10px", alignItems: "flex-start", overflowX: "auto", paddingBottom: "6px"}}>
          <div style={{display: "flex", flexDirection: "column", justifyContent: "space-between", height: "96px", fontSize: "11px", color: "var(--muted-foreground)", paddingRight: "4px", fontWeight: "500"}}>
            <span>T2</span>
            <span>T4</span>
            <span>T6</span>
          </div>
          <div style={{display: "grid", gridTemplateRows: "repeat(7, minmax(0, 1fr))", gridTemplateColumns: `repeat(${totalWeeks}, minmax(12px, 1fr))`, gridAutoFlow: "column", gap: "4px", flex: 1, minWidth: 0}}>
            {Array.from({length: totalWeeks * 7}, (_, i) => {
              const date = new Date(startDate);
              date.setDate(startDate.getDate() + i);
              const isFuture = date > today;
              const active = !isFuture && ((i * 7) % 11 === 0 || (i * 3) % 17 === 0);
              const level = active ? ((i % 4) + 1) : 0;
              const colors = ["#f1f5f9", "#e7f4f0", "#a7d3c4", "#65ae98", "#247c7a"];
              const dateLabel = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
              const listens = level * 15;
              return (
                <div
                  key={i}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    minWidth: 0,
                    background: isFuture ? "transparent" : colors[level],
                    borderRadius: "3px"
                  }}
                  title={isFuture ? undefined : `${dateLabel} - ${listens} lượt nghe`}
                  aria-label={isFuture ? undefined : `${dateLabel} - ${listens} lượt nghe`}
                />
              );
            })}
          </div>
        </div>

        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "12px", color: "var(--muted-foreground)", borderTop: "1px solid var(--border)", paddingTop: "12px"}}>
          <span>Cách tính lượt nghe</span>
          <div style={{display: "flex", alignItems: "center", gap: "6px"}}>
            <span>Ít</span>
            <div style={{width: "12px", height: "12px", background: "#f1f5f9", borderRadius: "3px"}} />
            <div style={{width: "12px", height: "12px", background: "#e7f4f0", borderRadius: "3px"}} />
            <div style={{width: "12px", height: "12px", background: "#a7d3c4", borderRadius: "3px"}} />
            <div style={{width: "12px", height: "12px", background: "#65ae98", borderRadius: "3px"}} />
            <div style={{width: "12px", height: "12px", background: "#247c7a", borderRadius: "3px"}} />
            <span>Nhiều</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
function Home({ role }: { role: Role }) { 
  const navigate = useNavigate(); 
  return (
    <>
      <PageHeading eyebrow="THỨ HAI, 13 THÁNG 10, 2026" title="Chào buổi sáng, Nguyễn An" subtitle={`Bạn đang đăng nhập với vai trò ${role}.`}>
        <Button onClick={() => navigate('/demo')}>Dữ liệu demo</Button>
        <Button primary onClick={() => navigate('/pois/new')}><Plus size={16} /> Tạo POI mới</Button>
      </PageHeading>

      <section className="stats-grid">
        {[
          ["Lượt nghe","18.426",Headphones],
          ["Lượt quét QR","9.284",QrCode],
          ["Thiết bị ẩn danh","6.812",Users],
          ["Thời lượng nghe","04:28",Clock3]
        ].map(([label,value,Icon]) => (
          <div className="stat-card" key={label as string}>
            <div className="stat-icon"><Icon size={20} /></div>
            <div>
              <p className="stat-label">{label as string}</p>
              <p className="stat-value">{value as string}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="content-grid legacy-home-grid" style={{marginBottom: "20px"}}>
        <ListeningChart />
        <Card>
          <div className="card-header">
            <div><h2>Ngôn ngữ sử dụng</h2><p>Phân bổ lượt nghe</p></div>
          </div>
          <div className="donut-wrap"><div className="donut"><div className="donut-center"><strong>18.4k</strong><span>lượt nghe</span></div></div></div>
          <div className="language-list">
            {[["Tiếng Việt","64%","dot-teal"],["English","22%","dot-orange"],["한국어","8%","dot-blue"],["Khác","6%","dot-grey"]].map(([x,y,c]) => (
              <div key={x}><span><i className={`language-dot ${c}`} />{x}</span><strong>{y}</strong></div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{marginBottom: "20px"}}>
        <ListeningContributionHeatmap />
      </div>

      <div className="lower-grid">
        <Card>
          <div className="card-header">
            <div><h2>Cần xử lý</h2><p>Danh sách ưu tiên trong workspace</p></div>
            <AlertTriangle size={20} color="#b47821" />
          </div>
          <div className="issue-list">
            <button onClick={() => navigate('/pois?filter=missing-audio')}>POI thiếu audio tiếng Anh <b>2 <ChevronRight size={15} /></b></button>
            <button onClick={() => navigate('/zones?filter=outdated')}>Offline Pack cần build lại <b>1 <ChevronRight size={15} /></b></button>
            <button onClick={() => navigate('/zones?filter=failed')}>Build gói thất bại <b>1 <ChevronRight size={15} /></b></button>
          </div>
        </Card>
        <Card>
          <div className="card-header">
            <div><h2>Hoạt động gần đây</h2><p>Thay đổi mới nhất</p></div>
          </div>
          <div className="activity-list">
            {["Offline Pack Hà Nội cổ đã được cập nhật","Đã lưu phiên bản mới cho Văn Miếu","Đã thêm tài khoản POI Manager"].map(x => (
              <div className="activity-item" key={x}>
                <div className="activity-icon teal"><Activity size={16} /></div>
                <div><strong>{x}</strong><span>Nguyễn An · 12 phút trước</span></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}function Pois({ mode = 'list' }: { mode?: 'list' | 'form' }) { const navigate = useNavigate(); const [query, setQuery] = useState(''); const [saved, setSaved] = useState(false); if (mode === 'form') return <PoiForm saved={saved} setSaved={setSaved} />; const rows = poiSeed.filter(x => x.toLowerCase().includes(query.toLowerCase())); return <><PageHeading title="Địa điểm (POI)" subtitle="Quản lý nội dung, audio và mã QR của các điểm tham quan."><Button onClick={() => navigate('/pois/new')}><Plus size={16} /> Tạo POI</Button></PageHeading><Card><div className="filter-row"><div className="search-box"><Search size={16} /><input placeholder="Tìm tên POI..." value={query} onChange={e => setQuery(e.target.value)} /></div><select className="select-control"><option>Tất cả khu vực</option>{zones.map(z => <option key={z}>{z}</option>)}</select><select className="select-control"><option>Đang hoạt động</option><option>Đã lưu trữ</option></select><button className="text-button" onClick={() => setQuery('')}>Xóa bộ lọc</button></div><div className="table-wrap"><table><thead><tr><th>ĐỊA ĐIỂM</th><th>KHU VỰC</th><th>AUDIO ENGLISH</th><th>PHIÊN BẢN</th><th>TRẠNG THÁI</th><th /></tr></thead><tbody>{rows.map((name, i) => <tr key={name}><td><div className="poi-cell"><div className="poi-thumb"><MapPin size={16} /></div><div><strong>{name}</strong><span>POI-{String(i+1).padStart(3,'0')} · Demo</span></div></div></td><td>{zones[i%3]}</td><td>{i === 3 ? <Badge tone="warn">Thiếu audio</Badge> : <Badge>Sẵn sàng</Badge>}</td><td>v{String(4 + i).padStart(2,'0')}</td><td><Badge tone={i === 3 ? 'warn' : 'ready'}>{i === 3 ? 'Cần xử lý' : 'Đang hoạt động'}</Badge></td><td><button className="icon-button" onClick={() => navigate(`/pois/${i+1}`)} aria-label={`Mở ${name}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div><div className="pagination"><span>Hiển thị {rows.length} / 12 địa điểm</span><div><button className="icon-button"><ChevronLeft size={16} /></button><button className="page-current">1</button><button className="icon-button"><ChevronRight size={16} /></button></div></div></Card></> }
function PoiForm({ saved, setSaved }: { saved: boolean; setSaved: (x: boolean) => void }) { const navigate = useNavigate(); const [tab, setTab] = useState('Thông tin & vị trí'); const tabs = ['Thông tin & vị trí','Nội dung & audio','Hình ảnh','QR','Lịch sử phiên bản']; return <><PageHeading eyebrow="ĐỊA ĐIỂM / POI-001" title="Văn Miếu - Quốc Tử Giám" subtitle="Chỉnh sửa nội dung và cấu hình điểm tham quan."><Button onClick={() => navigate('/pois')}>Hủy</Button><Button primary onClick={() => setSaved(true)}><Check size={16} /> {saved ? 'Đã lưu v12' : 'Lưu thay đổi'}</Button></PageHeading>{saved && <div className="success-banner"><Check size={16} /> Đã lưu phiên bản mới. Offline Pack liên quan đã chuyển sang trạng thái cần build lại.</div>}<Card><div className="tabs">{tabs.map(t => <button className={tab === t ? 'tab-active' : ''} onClick={() => setTab(t)} key={t}>{t}</button>)}</div>{tab === 'Thông tin & vị trí' && <div className="form-grid"><Field label="Tên POI"><input defaultValue="Văn Miếu - Quốc Tử Giám" /></Field><Field label="Khu vực"><select><option>Hà Nội cổ</option></select></Field><Field label="Mô tả ngắn"><textarea defaultValue="Di tích lịch sử và văn hóa nổi bật giữa lòng Hà Nội." /></Field><Field label="Priority"><input type="number" defaultValue="1" /></Field><div className="map-mock"><Map size={24} /><strong>Bản đồ mô phỏng</strong><span>21.0278, 105.8356 · Ranh giới Hà Nội cổ</span></div></div>}{tab === 'Nội dung & audio' && <div className="language-panels"><div className="language-panel"><div><strong>English</strong><Badge>Sẵn sàng</Badge></div><Field label="Nội dung"><textarea defaultValue="The Temple of Literature is a historic landmark in Hanoi." /></Field><div className="audio-row"><FileAudio size={18} /><span>van-mieu-en.mp3 · 02:48</span><button className="text-button"><Headphones size={15} /> Nghe thử</button><button className="secondary-button"><Upload size={14} /> Tải MP3</button></div></div><div className="language-panel"><div><strong>Tiếng Việt</strong><Badge>Sẵn sàng</Badge></div><Field label="Nội dung"><textarea defaultValue="Văn Miếu là biểu tượng lâu đời của truyền thống hiếu học Việt Nam." /></Field><button className="secondary-button"><Activity size={14} /> Tạo TTS demo</button></div></div>}{tab === 'Hình ảnh' && <div className="upload-zone"><ImageIcon size={28} /><strong>Thêm ảnh thumbnail</strong><span>PNG, JPG tối đa 5MB · dữ liệu demo</span><Button><Upload size={15} /> Chọn tệp</Button></div>}{tab === 'QR' && <div className="qr-layout"><div className="qr-code"><QrCode size={125} /></div><div><Field label="Mã ngắn"><input defaultValue="vmqtdg" /></Field><Field label="URL đích"><input defaultValue="https://demo.auto-audio.guide/p/vmqtdg" /></Field><Button><Download size={15} /> Tải PNG</Button></div></div>}{tab === 'Lịch sử phiên bản' && <div className="version-list">{['v12 · 13/10/2026 · Nguyễn An','v11 · 06/10/2026 · Trần Minh','v10 · 20/09/2026 · Nguyễn An'].map((v,i) => <div className="version-row" key={v}><div><strong>{v}</strong><span>{i===0 ? 'Phiên bản hiện tại' : 'Snapshot nội dung'}</span></div><button className="text-button">Xem so sánh</button></div>)}</div>}</Card></> }

function Zones() { const navigate = useNavigate(); const [building, setBuilding] = useState<string | null>(null); const build = (z: string) => { setBuilding(z); setTimeout(() => setBuilding(null), 900) }; return <><PageHeading title="Khu vực & Offline Pack" subtitle="Ranh giới địa lý và các gói nội dung dùng offline."><Button onClick={() => navigate('/zones/new')}><Plus size={16} /> Tạo khu vực</Button></PageHeading><div className="zone-grid">{zones.map((z,i) => <Card key={z}><div className="zone-card-head"><div className="zone-icon"><FolderKanban size={19} /></div><button className="more-button"><MoreHorizontal size={18} /></button></div><h2>{z}</h2><p className="page-subtitle">{i === 1 ? 4 : 3} POI active · 21.03 MB</p><div className="zone-status"><Badge tone={i===1?'warn':'ready'}>{i===1?'Cần build lại':'Đã cập nhật'}</Badge><span>pack v{2+i}.8</span></div><div className="progress-track"><span style={{width: `${70+i*8}%`}} /></div><div className="zone-actions"><button className="text-button" onClick={() => navigate(`/zones/${i+1}`)}>Xem chi tiết <ChevronRight size={14} /></button><button className="secondary-button" onClick={() => build(z)} disabled={building === z}>{building === z ? 'Đang tạo...' : 'Build lại'}</button></div></Card>)}</div><Card><div className="card-header"><div><h2>Quy trình Offline Pack</h2><p>Pack mới tự publish khi build thành công. Pack cũ được giữ nếu build thất bại.</p></div><ShieldCheck size={20} color="var(--primary)" /></div><div className="stepper"><span><b>1</b> Kiểm tra audio English</span><span><b>2</b> Tạo gói</span><span><b>3</b> Publish phiên bản</span></div></Card></> }
function ZoneForm() { return <><PageHeading title="Tạo khu vực mới" subtitle="Thiết lập tên, mô tả và polygon geofence."><Button>Hủy</Button><Button primary><Check size={15} /> Lưu khu vực</Button></PageHeading><Card><div className="form-grid"><Field label="Tên khu vực"><input placeholder="Ví dụ: Hà Nội cổ" /></Field><Field label="Tên tiếng Anh"><input placeholder="Old Quarter Hanoi" /></Field><Field label="Mô tả"><textarea placeholder="Mô tả ngắn về khu vực..." /></Field><div className="map-mock polygon"><Map size={25} /><strong>Bản đồ mô phỏng</strong><span>Thêm điểm · Khép vùng · Đặt lại</span><div className="map-actions"><Button>Thêm điểm</Button><Button>Khép vùng</Button><Button>Đặt lại</Button></div></div></div></Card></> }
function ZoneDetail() { const [tab, setTab] = useState('Tổng quan & ranh giới'); const [build, setBuild] = useState(false); return <><PageHeading eyebrow="KHU VỰC / ZONE-001" title="Hà Nội cổ" subtitle="3 POI active · pack v2.8 · cập nhật 12 phút trước"><Button><Archive size={15} /> Archive</Button><Button primary onClick={() => setBuild(true)}>{build ? 'Đang tạo gói...' : 'Build Offline Pack'}</Button></PageHeading><Card><div className="tabs">{['Tổng quan & ranh giới','POI & audio','Offline Pack'].map(t => <button className={tab===t?'tab-active':''} onClick={() => setTab(t)} key={t}>{t}</button>)}</div>{tab === 'Tổng quan & ranh giới' && <div className="detail-grid"><div><h2>Ranh giới geofence</h2><div className="map-mock tall"><Map size={30} /><strong>Bản đồ mô phỏng</strong><span>Polygon đã khép kín · 1.8 km²</span></div></div><div className="detail-list"><p><span>Pack đang phục vụ</span><strong>v2.8 · Đã cập nhật</strong></p><p><span>Dung lượng</span><strong>21.03 MB</strong></p><p><span>Lần build gần nhất</span><strong>13/10/2026 09:42</strong></p></div></div>}{tab === 'POI & audio' && <div className="readiness-list">{['Văn Miếu - Quốc Tử Giám','Hoàng thành Thăng Long','Hồ Hoàn Kiếm'].map((x,i) => <div className="version-row" key={x}><div><strong>{x}</strong><span>English · Tiếng Việt · 한국어</span></div><Badge tone={i===1?'warn':'ready'}>{i===1?'Thiếu English':'Audio sẵn sàng'}</Badge></div>)}</div>}{tab === 'Offline Pack' && <div className="build-state"><PackageCheck size={30} /><h2>Pack v2.8 đã publish</h2><p>Build job #PACK-028 thành công · cập nhật 13/10/2026 09:42.</p><Button primary onClick={() => setBuild(true)}><RotateCcw size={15} /> Build lại</Button></div>}</Card></> }

function Analytics() { const [tab, setTab] = useState('Thống kê'); return <><PageHeading title="Phân tích" subtitle="Dữ liệu demo theo lượt nghe, QR và Offline Pack."><Button><Download size={15} /> Xuất báo cáo</Button></PageHeading><Card><div className="filter-row"><select className="select-control"><option>7 ngày qua</option><option>Hôm nay</option><option>30 ngày qua</option><option>Tùy chọn</option></select><select className="select-control"><option>Tất cả khu vực</option></select><select className="select-control"><option>Tất cả ngôn ngữ</option></select><select className="select-control"><option>Tất cả trigger</option><option>Geofence</option><option>QR</option></select></div><div className="tabs analytics-tabs"><button className={tab==='Thống kê'?'tab-active':''} onClick={() => setTab('Thống kê')}>Thống kê</button><button className={tab==='Bản đồ nhiệt'?'tab-active':''} onClick={() => setTab('Bản đồ nhiệt')}>Bản đồ nhiệt</button></div>{tab==='Thống kê' ? <><div className="analytics-kpis">{[['Lượt nghe','18.426','+12,8%'],['Lượt QR','9.284','+8,4%'],['Thiết bị ẩn danh','6.812','+5,2%'],['Tổng thời lượng','1.372 giờ','+4,1%'],['TB mỗi lượt','04:28','+2,1%'],['Tải Offline Pack','1.204','+16,2%']].map(x => <div className="mini-kpi" key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong><small>{x[2]} so kỳ trước</small></div>)}</div><div className="fake-chart large"><div className="chart-bars">{Array.from({length: 30}, (_, i) => <i key={i} style={{height: `${26 + ((i * 29) % 70)}%`}} />)}</div></div><div className="empty-note"><Clock3 size={15} /> Cập nhật gần nhất 13/10/2026 10:15 · chu kỳ KPI 5 phút</div></> : <div className="heatmap"><Map size={32} /><h2>Mật độ lượt nghe</h2><p>Bản đồ nhiệt dùng tọa độ POI và trọng số lượt nghe, không dùng vị trí thật của khách.</p><div className="heat-legend"><span>Thấp</span><i /><i /><i /><i /><span>Cao</span></div></div>}</Card></> }

function Accounts() { const [sent, setSent] = useState(false); return <><PageHeading title="Quản lý tài khoản" subtitle="Chỉ Super Admin có thể quản lý tài khoản và vai trò."><Button primary><Plus size={16} /> Tạo tài khoản</Button></PageHeading><Card><div className="filter-row"><div className="search-box"><Search size={16} /><input placeholder="Tìm họ tên hoặc email..." /></div><select className="select-control"><option>Tất cả vai trò</option>{roles.map(r => <option key={r}>{r}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>HỌ TÊN</th><th>EMAIL</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th>ĐĂNG NHẬP GẦN NHẤT</th><th /></tr></thead><tbody>{[['Nguyễn An','admin@auto-audio.demo','Super Admin','Đang hoạt động'],['Trần Minh','poi@auto-audio.demo','POI Manager','Đang hoạt động'],['Lê Hà','ops@auto-audio.demo','Admin','Chờ thiết lập']].map(x => <tr key={x[1]}><td><div className="poi-cell"><div className="profile-avatar">{x[0].slice(0,2)}</div><strong>{x[0]}</strong></div></td><td>{x[1]}</td><td><Badge tone="neutral">{x[2]}</Badge></td><td><Badge tone={x[3]==='Đang hoạt động'?'ready':'warn'}>{x[3]}</Badge></td><td>Hôm nay, 09:42</td><td><button className="text-button" onClick={() => setSent(true)}>Gửi lại link</button></td></tr>)}</tbody></table></div>{sent && <div className="success-banner"><Check size={15} /> Link thiết lập đã được ghi nhận để gửi lại (demo).</div>}</Card></> }
function SettingsPage() { const [saved, setSaved] = useState(false); return <><PageHeading title="Cấu hình hệ thống" subtitle="Thiết lập áp dụng cho toàn bộ POI trong workspace."><Button primary onClick={() => setSaved(true)}><Check size={15} /> Lưu cấu hình</Button></PageHeading>{saved && <div className="success-banner"><Check size={15} /> Đã lưu cấu hình geofence.</div>}<Card className="settings-card"><h2>Geofence mặc định</h2><p className="page-subtitle">Bán kính dùng khi kích hoạt audio theo vị trí.</p><Field label="Bán kính (mét)" hint="Giá trị đề xuất: 10–200 m · mặc định 30 m"><input type="number" defaultValue="30" min="10" max="200" /></Field><div className="warning-box"><AlertTriangle size={17} /><span>Thay đổi sẽ áp dụng cho tất cả POI chưa có cấu hình riêng. Hệ thống sẽ yêu cầu xác nhận trước khi lưu.</span></div></Card></> }
function Forbidden() { const navigate = useNavigate(); return <main className="center-page"><ShieldCheck size={38} /><h1>Không có quyền truy cập</h1><p>Vai trò hiện tại không được phép mở trang này.</p><Button primary onClick={() => navigate('/')}>Về trang chủ</Button></main> }

function RoutedPage() { const path = useLocation().pathname; const [role, setRole] = useState<Role>('Super Admin'); if (path === '/login' || path === '/verify-otp' || path === '/forgot-password' || path === '/reset-password' || path === '/set-password') return <AuthPage mode={path.slice(1)} />; if (path === '/forbidden') return <Forbidden />; let content: React.ReactNode; let title = 'Trang chủ'; if (path === '/pois' || path === '/pois/') { content = <Pois />; title = 'Địa điểm'; } else if (path === '/pois/new' || /^\/pois\/\d+/.test(path)) { content = <Pois mode="form" />; title = 'Địa điểm'; } else if (path === '/zones') { content = <Zones />; title = 'Khu vực & Offline Pack'; } else if (path === '/zones/new' || /^\/zones\/\d+\/edit/.test(path)) { content = <ZoneForm />; title = 'Khu vực'; } else if (/^\/zones\/\d+/.test(path)) { content = <ZoneDetail />; title = 'Khu vực'; } else if (path === '/analytics') { content = <Analytics />; title = 'Phân tích'; } else if (path === '/accounts') { if (role !== 'Super Admin') return <Forbidden />; content = <Accounts />; title = 'Tài khoản'; } else if (path === '/settings') { if (role === 'POI Manager') return <Forbidden />; content = <SettingsPage />; title = 'Cấu hình'; } else { content = <Home role={role} />; } return <Shell role={role} setRole={setRole} title={title}>{content}</Shell> }

export default function Page() {
  return <RoutedPage />
}
