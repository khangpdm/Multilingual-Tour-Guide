import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, apiBase, ApiError, listAll } from './api'
import { permissions, type Capabilities, type Account, type AudioTask, type Audit, type Content, type Data, type Language, type Permission, type Poi, type Role, type Session, type Zone } from './types'

export const stamp = () => new Date().toISOString()
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`
export const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'
export const poiName = (poi?: Poi) => poi?.content.vi?.name || 'Chưa có tên'
export const emptyContent = (): Content => ({ name: '', address: '', description: '', introduction: '', text: '', audio_url: null, audio_sha256: null, audio_source: null, is_edited: false, updated_at: stamp() })
export const activeTask = (task: AudioTask) => ['queued', 'processing'].includes(task.status)
export function enqueue(data: Data, poi: Poi, locales: string[], actor: string, replace = false, retranslate = false): Data {
  const tasks = [...data.tasks]
  for (const locale of locales) {
    if (tasks.some(task => task.poi_id === poi.poi_id && task.language_code === locale && activeTask(task))) continue
    const content = poi.content[locale]
    if (content?.audio_source === 'UPLOADED' && !replace && (locale === 'vi' || (content.is_edited && !retranslate))) continue
    tasks.unshift({ task_id: uid('task'), poi_id: poi.poi_id, language_code: locale, status: 'queued', progress: 0, error: null, retry_count: 0, created_by: actor, created_at: stamp(), started_at: null, finished_at: null })
  }
  return { ...data, tasks }
}
const emptyData: Data = { languages: [], zones: [], pois: [], accounts: [], roles: [], tasks: [], audit: [] }
const demoKey = 'tour-guide.admin.api-spec.v2'
function seed(): Data {
  const created_at = stamp()
  return {
    languages: [{ code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', is_active: true, is_default: true, display_order: 1 }, { code: 'en', name: 'English', native_name: 'English', is_active: true, is_default: false, display_order: 2 }],
    zones: [{ zone_id: 'zone_quan_1', name: 'Quận 1', map_region: { bbox: [106.68, 10.76, 106.72, 10.80], min_zoom: 11, max_zoom: 16 }, is_active: true }],
    pois: [{ poi_id: 'poi_0042', zone_id: 'zone_quan_1', category: 'landmark', location: { lat: 10.7726, lng: 106.698 }, geofence_radius_m: 30, qr_code: null, status: 'published', images: [], content: { vi: { ...emptyContent(), name: 'Chợ Bến Thành', text: 'Chợ Bến Thành là biểu tượng văn hóa và lịch sử của Thành phố Hồ Chí Minh.', audio_source: 'TTS' } }, last_modified_by: 'user_demo', created_at, updated_at: created_at }],
    accounts: [{ user_id: 'user_demo', email: 'admin@example.test', full_name: 'Quản trị viên demo', role_id: 'super_admin', status: 'active', created_at }],
    roles: [
      { role_id: 'super_admin', name: 'Super Admin', level: 3, permissions: [...permissions], is_system: true },
      { role_id: 'admin', name: 'Admin', level: 2, permissions: permissions.filter(permission => !['user.create', 'role.create', 'role.assign_permission', 'audit.export', 'system.manage_constants', 'system.manage_languages', 'system.manage_integrations'].includes(permission)), is_system: true },
      { role_id: 'poi_manager', name: 'POI Manager', level: 1, permissions: ['poi.create', 'poi.edit', 'poi.delete', 'poi.view', 'poi.assign_qr', 'audio.view_tasks', 'audio.retry_task', 'analytics.view_poi_reports', 'heatmap.view_live'], is_system: true },
      { role_id: 'user', name: 'Guest Tourist', level: 0, permissions: [], is_system: true },
    ], tasks: [], audit: [],
  }
}
type Mutation = { permission: Permission; path: string; method?: string; body?: unknown; action: string; target: string; before?: unknown; after?: unknown; demo: (data: Data) => Data }
type Store = { capabilities: Capabilities; localDatabase: boolean; tableCounts: Record<string, number>; data: Data; user: Account | null; mode: 'live' | 'demo'; ready: boolean; busy: boolean; error: string; streamStatus: string; can: (permission: Permission) => boolean; level: number; login: (username: string, password: string) => Promise<void>; logout: () => Promise<void>; enterDemo: () => void; switchRole: (role: string) => void; reload: () => Promise<void>; mutate: <T = unknown>(mutation: Mutation) => Promise<T | undefined> }
const Context = createContext<Store | null>(null)
export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(emptyData)
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({})
  const [session, setSession] = useState<Session | null>(null)
  const [mode, setMode] = useState<'live' | 'demo'>('live')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [streamStatus, setStreamStatus] = useState('Chưa kết nối')
  const mutationLock = useRef(false)
  const generation = useRef(0)
  const can = (permission: Permission) => Boolean(session && ((mode === 'demo' && session.user.role_id === 'super_admin') || session.permissions.includes(permission)))
  async function loadLive(current: Session) {
    const requestGeneration = ++generation.current
    const allowed = (permission: Permission) => current.permissions.includes(permission)
    const next: Data = { ...emptyData }
    let nextTableCounts: Record<string, number> = {}
    const jobs: Promise<void>[] = []
    if (allowed('poi.view')) jobs.push((async () => {
      nextTableCounts = (await api<{ tables: Record<string, number> }>('/admin/database/summary')).tables
      const summaries = await listAll<{ poi_id: string; content_status: Record<string, string> }>('/admin/pois')
      const pois: Poi[] = []
      for (let offset = 0; offset < summaries.length; offset += 8) pois.push(...await Promise.all(summaries.slice(offset, offset + 8).map(async item => { const result = await api<Poi & { poi?: Poi }>(`/admin/pois/${encodeURIComponent(item.poi_id)}`); return { ...(result.poi ?? result), content_status: item.content_status } })))
      next.pois = pois
      next.zones = (await api<{ zones: Zone[] }>('/admin/zones')).zones
      next.languages = (await api<{ languages: Language[] }>('/admin/languages')).languages
    })())
    if (allowed('user.view')) jobs.push(listAll<Account>('/admin/users').then(items => { next.accounts = items }))
    if (allowed('role.view')) jobs.push(api<{ roles: Role[] }>('/admin/roles').then(result => { next.roles = result.roles }))
    if (allowed('audio.view_tasks')) jobs.push(listAll<AudioTask>('/admin/audio-tasks').then(items => { next.tasks = items }))
    if (allowed('audit.view')) jobs.push(listAll<Audit>('/admin/audit-logs').then(items => { next.audit = items }))
    await Promise.all(jobs)
    if (generation.current === requestGeneration) { setData(next); setTableCounts(nextTableCounts) }
  }
  useEffect(() => {
    let cancelled = false
    api<Session>('/admin/me/permissions').then(async current => { if (!cancelled) { setSession(current); await loadLive(current) } }).catch(reason => { if (!cancelled && !(reason instanceof ApiError && reason.status === 401)) setError(String(reason.message)) }).finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true; generation.current++ }
  }, [])
  useEffect(() => {
    const expired = () => { generation.current++; setSession(null); setData(emptyData); setError('') }
    window.addEventListener('admin-session-expired', expired)
    return () => window.removeEventListener('admin-session-expired', expired)
  }, [])
  useEffect(() => {
    if (mode !== 'live' || !session || !(session.user.role_id === 'super_admin' || session.permissions.includes('audio.view_tasks'))) return
    let closed = false
    let pending = false
    let previous = ''
    async function poll() {
      if (pending || closed) return
      pending = true
      try {
        const tasks = await listAll<AudioTask>('/admin/audio-tasks')
        if (closed) return
        const signature = JSON.stringify(tasks.map(task => [task.task_id, task.status, task.progress]))
        setData(current => ({ ...current, tasks }))
        setStreamStatus('Tự cập nhật mỗi 3 giây')
        if (previous && previous !== signature && tasks.some(task => task.status === 'completed')) {
          const pois = await listAll<Poi>('/admin/pois')
          if (!closed) setData(current => ({ ...current, pois }))
        }
        previous = signature
      } catch { if (!closed) setStreamStatus('Không tải được tiến độ. Kiểm tra kết nối hoặc tải lại.') }
      finally { pending = false }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 3000)
    return () => { closed = true; window.clearInterval(timer) }
  }, [mode, session])
  async function reload() { if (mode === 'live' && session) { setBusy(true); try { const current = await api<Session>('/admin/me/permissions'); setSession(current); await loadLive(current); setError('') } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) } } }
  async function login(username: string, password: string) { const current = await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); setMode('live'); setSession(current); setError(''); try { await loadLive(current) } catch (reason) { setError((reason as Error).message) } }
  async function logout() { if (mode === 'live') await api('/auth/logout', { method: 'POST' }); generation.current++; setSession(null); setData(emptyData); setTableCounts({}); setMode('live'); setError('') }
  function enterDemo() {
    generation.current++
    let next = seed()
    try { const saved = localStorage.getItem(demoKey); if (saved) { const parsed = JSON.parse(saved) as Data; if (Object.keys(emptyData).every(key => Array.isArray(parsed[key as keyof Data])) && parsed.roles.some(role => role.role_id === 'super_admin') && parsed.accounts.some(account => account.user_id === 'user_demo')) next = parsed } } catch { setError('Không đọc được dữ liệu đã lưu; dùng dữ liệu mặc định.') }
    setError(''); setData(next); setTableCounts({}); setMode('demo'); setSession({ user: { ...next.accounts.find(account => account.user_id === 'user_demo')!, role_id: 'super_admin' }, permissions: [...permissions] }); setReady(true)
  }
  function switchRole(roleId: string) { if (mode !== 'demo' || !session) return; const role = data.roles.find(item => item.role_id === roleId); if (role && roleId !== 'user') setSession({ user: { ...session.user, role_id: roleId }, permissions: role.permissions }) }
  async function mutate<T>(mutation: Mutation): Promise<T | undefined> {
    if (!session || !can(mutation.permission)) throw new Error('Bạn không có quyền thực hiện thao tác này.')
    if (mutationLock.current) throw new Error('Đang lưu thay đổi khác. Vui lòng chờ.')
    mutationLock.current = true; setBusy(true); setError('')
    try {
      if (mode === 'live') {
        const result = await api<T>(mutation.path, { method: mutation.method || 'POST', body: mutation.body instanceof FormData ? mutation.body : mutation.body === undefined ? undefined : JSON.stringify(mutation.body) })
        try { const current = await api<Session>('/admin/me/permissions'); setSession(current); await loadLive(current) } catch (reason) { setError(`Đã lưu, nhưng chưa tải lại được dữ liệu: ${(reason as Error).message}`) }
        return result
      }
      const next = mutation.demo(structuredClone(data))
      next.audit.unshift({ log_id: uid('audit'), actor_user_id: session.user.user_id, actor_email: session.user.email, action: mutation.action, target_id: mutation.target, before: mutation.before ?? null, after: mutation.after ?? null, timestamp: stamp() })
      localStorage.setItem(demoKey, JSON.stringify(next)); setData(next)
      const updatedUser = next.accounts.find(account => account.user_id === session.user.user_id) ?? session.user
      const roleId = updatedUser.role_id
      const role = next.roles.find(item => item.role_id === roleId)
      if (role) setSession({ ...session, user: { ...session.user, role_id: roleId }, permissions: role.permissions })
    } finally { mutationLock.current = false; setBusy(false) }
  }
  const levels: Record<string, number> = { super_admin: 3, admin: 2, poi_manager: 1 }
  const level = data.roles.find(role => role.role_id === session?.user.role_id)?.level ?? levels[session?.user.role_id ?? ''] ?? 0
  return <Context.Provider value={{ capabilities: session?.capabilities || {}, localDatabase: mode === 'live' && session?.capabilities?.local_database === true, tableCounts, data, user: session?.user ?? null, mode, ready, busy, error, streamStatus, can, level, login, logout, enterDemo, switchRole, reload, mutate }}>{children}</Context.Provider>
}
export function useAdmin() { const context = useContext(Context); if (!context) throw new Error('AdminProvider is required'); return context }
