import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { api, ApiError } from '../../admin/api'
import { useAdmin, type MfaChallenge } from '../../admin/store'
import { Field } from '../../shared/ui'

export function AuthPage({ activation = false, reset = false }: { activation?: boolean; reset?: boolean }) {
  const { login, verifyMfa } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const [token] = useState(() => new URLSearchParams(location.search).get('token') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [name, setName] = useState('')
  const [forgot, setForgot] = useState(false)
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null)
  const [code, setCode] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const newPassword = activation || reset

  useEffect(() => {
    if (newPassword && location.search) navigate(location.pathname, { replace: true })
  }, [newPassword, location.pathname, location.search, navigate])

  useEffect(() => {
    if (!challenge) return
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setRemaining(seconds)
      if (!seconds) {
        setChallenge(null); setCode(''); setError('OTP đã hết hạn. Vui lòng đăng nhập lại.')
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [challenge, expiresAt])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true); setError(''); setMessage('')
    try {
      if (forgot) {
        await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
        setMessage('Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi. Vui lòng kiểm tra cả thư rác.')
      } else if (newPassword) {
        if (!token) throw new Error('Thiếu liên kết xác thực. Vui lòng mở liên kết trong email hoặc yêu cầu liên kết mới.')
        if (password.length < 8 || !/\p{L}/u.test(password) || !/\d/.test(password) || new TextEncoder().encode(password).length > 72 || password !== confirmation) {
          throw new Error('Mật khẩu cần ít nhất 8 ký tự, có chữ và số, tối đa 72 byte; xác nhận phải trùng khớp.')
        }
        await api(activation ? '/auth/activate' : '/auth/reset-password', { method: 'POST', body: JSON.stringify(activation ? { token, password, full_name: name } : { token, password, confirmation }) })
        if (reset) window.dispatchEvent(new Event('admin-session-expired'))
        setPassword(''); setConfirmation(''); setDone(true)
        setMessage(activation ? 'Đã kích hoạt tài khoản. Vui lòng đăng nhập bằng email.' : 'Đã đổi mật khẩu và thu hồi các phiên cũ. Vui lòng đăng nhập lại.')
      } else if (challenge) {
        await verifyMfa(challenge.challenge_token, code)
        setChallenge(null); setCode(''); navigate('/', { replace: true })
      } else {
        const next = await login(email, password)
        setPassword('')
        if (next) { setChallenge(next); setCode(''); setExpiresAt(Date.now() + next.expires_in * 1000) }
        else navigate('/', { replace: true })
      }
    } catch (reason) {
      setError((reason as Error).message)
      if (reason instanceof ApiError && ['MFA_EXPIRED', 'ACCOUNT_LOCKED', 'ACCOUNT_DEACTIVATED', 'ADMIN_ACCESS_DENIED'].includes(reason.code || '')) {
        setChallenge(null); setCode('')
      }
    } finally { setPending(false) }
  }

  function backToLogin() {
    setForgot(false); setChallenge(null); setCode(''); setPassword(''); setConfirmation(''); setError(''); setMessage('')
    if (newPassword) navigate('/login', { replace: true })
  }

  const title = activation ? 'Kích hoạt tài khoản' : reset ? 'Đặt lại mật khẩu' : forgot ? 'Quên mật khẩu' : challenge ? 'Xác thực Super Admin' : 'Chào mừng trở lại'
  return <main className="auth-page"><div className="auth-layout"><section className="panel auth-card">
    <div className="auth-card-head"><div className="auth-icon"><img src="/logo.png" alt="Tour Guide Logo" className="auth-logo-img" /></div><p className="auth-eyebrow">MULTILINGUAL TOUR GUIDE</p><h1>{title}</h1><p>{challenge ? 'Nhập OTP 6 chữ số đã gửi qua email. Chưa xác thực thì chưa thể truy cập quản trị.' : newPassword ? 'Đặt mật khẩu có ít nhất 8 ký tự, gồm chữ và số.' : forgot ? 'Nhập email của tài khoản quản trị.' : 'Đăng nhập bằng email để vào bảng điều khiển quản trị.'}</p></div>
    {!done && <form className="admin-form auth-form" onSubmit={submit}>
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: '1rem', minWidth: 0 }}>
        {activation && <Field label="Họ và tên"><input required autoComplete="name" maxLength={255} value={name} onChange={event => setName(event.target.value)} /></Field>}
        {!newPassword && !challenge && <Field label="Email"><input type="email" required maxLength={255} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Nhập email quản trị" value={email} onChange={event => setEmail(event.target.value)} /></Field>}
        {challenge ? <><Field label="Mã OTP"><input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ''))} /></Field><p className="auth-hint" role="status">OTP còn {remaining} giây. Tối đa 3 lần nhập sai; không tự gửi lại mã.</p></> : !forgot && <Field label={newPassword ? 'Mật khẩu mới' : 'Mật khẩu'}><div className="auth-password"><input type={showPassword ? 'text' : 'password'} required minLength={newPassword ? 8 : undefined} autoComplete={newPassword ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>}
        {newPassword && <Field label="Xác nhận mật khẩu"><input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></Field>}
        <button type="submit" className="primary-button">{pending ? 'Đang xử lý…' : newPassword ? 'Lưu mật khẩu' : forgot ? 'Gửi hướng dẫn' : challenge ? 'Xác nhận OTP' : 'Đăng nhập'}</button>
        {!newPassword && !forgot && !challenge && <button type="button" className="auth-forgot-link" onClick={() => { setForgot(true); setPassword(''); setError('') }}>Quên mật khẩu?</button>}
      </fieldset>
    </form>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {message && <p className="auth-hint" role="status">{message}</p>}
    {(newPassword || forgot || challenge) && <button type="button" className="secondary-button" disabled={pending} onClick={backToLogin}>Trở lại đăng nhập</button>}
  </section></div></main>
}
