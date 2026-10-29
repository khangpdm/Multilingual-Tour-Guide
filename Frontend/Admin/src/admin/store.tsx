import { createContext, useContext, useState, type ReactNode } from 'react'

export type Role = 'Super Admin' | 'Admin' | 'POI Manager' | 'User'
export type Permission = 'poi.write' | 'zone.write' | 'language.write' | 'audio.write' | 'analytics.read' | 'audit.read' | 'account.write' | 'role.write'
export const permissions: Permission[] = ['poi.write', 'zone.write', 'language.write', 'audio.write', 'analytics.read', 'audit.read', 'account.write', 'role.write']
export const roleNames: Role[] = ['Super Admin', 'Admin', 'POI Manager', 'User']
export type Language = { code: string; name: string; native_name: string; is_active: boolean; is_default: boolean; display_order: number }
export type Zone = { id: string; name: string; min_lng: number; min_lat: number; max_lng: number; max_lat: number; min_zoom: number; max_zoom: number; is_active: boolean }
export type Content = { language_code: string; name: string; description: string; text: string; is_edited: boolean; audio_url: string; audio_sha256: string; updated_at: string }
export type Poi = { id: string; zone_id: string; category: string; latitude: number; longitude: number; radius: number; qr_code: string; status: 'active' | 'inactive'; images: string[]; contents: Content[]; last_modified_by: string; created_at: string; updated_at: string }
export type Account = { id: string; email: string; role: Role; status: 'PENDING_ACTIVATION' | 'ACTIVE' | 'DEACTIVATED'; created_at: string; updated_at: string }
export type AudioTask = { id: string; poi_id: string; language_code: string; state: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; progress: number; error: string; retry_count: number; created_by: string | null; created_at: string; started_at: string | null; finished_at: string | null }
export type Audit = { id: string; actor_user_id: string; actor_role: Role; action: string; target_id: string; before: unknown; after: unknown; created_at: string }
export type Event = { id: string; event_type: 'AUDIO_PLAY' | 'QR_SCAN' | 'PACK_DOWNLOAD'; poi_id: string | null; zone_id: string | null; language_code: string; trigger_source: 'geofence' | 'qr_scan' | 'manual_tap'; audio_tier: string; device_id: string; occurred_at: string }
export type Density = { poi_id: string; hour_bucket: string; visit_count: number }
export type Data = { languages: Language[]; zones: Zone[]; pois: Poi[]; accounts: Account[]; tasks: AudioTask[]; audit: Audit[]; grants: Record<Role, Permission[]>; events: Event[]; density: Density[]; defaultRadius: number }
const storageKey = 'tour-guide.admin.erd.v1'
export const actorId = '00000000-0000-4000-8000-000000000001'
export const stamp = () => new Date().toISOString()
export const uid = () => crypto.randomUUID()
export const poiName = (poi?: Poi) => poi?.contents.find(content => content.language_code === 'vi')?.name || poi?.contents.find(content => content.name)?.name || 'Chưa có tên'
export const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—'
export const emptyContent = (code: string): Content => ({ language_code: code, name: '', description: '', text: '', is_edited: false, audio_url: '', audio_sha256: '', updated_at: stamp() })

function seed(): Data {
  const created_at = stamp()
  const zones: Zone[] = [
    { id: 'zone-hanoi', name: 'Hà Nội cổ', min_lat: 20.95, max_lat: 21.1, min_lng: 105.75, max_lng: 105.95, min_zoom: 10, max_zoom: 18, is_active: true },
    { id: 'zone-saigon', name: 'Trung tâm Sài Gòn', min_lat: 10.7, max_lat: 10.85, min_lng: 106.6, max_lng: 106.8, min_zoom: 10, max_zoom: 18, is_active: true },
    { id: 'zone-hoian', name: 'Phố cổ Hội An', min_lat: 15.85, max_lat: 15.95, min_lng: 108.25, max_lng: 108.4, min_zoom: 11, max_zoom: 19, is_active: true },
  ]
  const pois: Poi[] = ['Văn Miếu - Quốc Tử Giám', 'Dinh Độc Lập', 'Chùa Cầu'].map((name, index) => ({ id: `poi-${index + 1}`, zone_id: zones[index].id, category: 'Di tích', latitude: [21.0278, 10.777, 15.877][index], longitude: [105.8356, 106.695, 108.326][index], radius: 30, qr_code: `tour-poi-${index + 1}`, status: 'active', images: [], contents: [{ ...emptyContent('vi'), name, description: 'Nội dung minh họa, cần biên tập trước khi xuất bản.', text: `Chào mừng bạn đến với ${name}.` }], last_modified_by: actorId, created_at, updated_at: created_at }))
  const events: Event[] = Array.from({ length: 96 }, (_, index) => {
    const poi = pois[Math.floor(index / 3) % pois.length]
    const event_type = (['AUDIO_PLAY', 'QR_SCAN', 'PACK_DOWNLOAD'] as const)[index % 3]
    return { id: `event-${index}`, event_type, poi_id: event_type === 'PACK_DOWNLOAD' ? null : poi.id, zone_id: event_type === 'PACK_DOWNLOAD' ? poi.zone_id : null, language_code: index % 2 ? 'en' : 'vi', trigger_source: (['geofence', 'qr_scan', 'manual_tap'] as const)[Math.floor(index / 9) % 3], audio_tier: ['tier1', 'tier1_5', 'tier2', 'tier3'][index % 4], device_id: `device-${index % 17}`, occurred_at: new Date(Date.now() - index * 90 * 60000).toISOString() }
  })
  return {
    languages: [{ code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', is_active: true, is_default: true, display_order: 0 }, { code: 'en', name: 'English', native_name: 'English', is_active: true, is_default: false, display_order: 1 }], zones, pois,
    accounts: [{ id: actorId, email: 'admin@auto-audio.demo', role: 'Super Admin', status: 'ACTIVE', created_at, updated_at: created_at }, { id: 'account-editor', email: 'editor@auto-audio.demo', role: 'POI Manager', status: 'PENDING_ACTIVATION', created_at, updated_at: created_at }],
    tasks: [{ id: 'task-demo', poi_id: pois[0].id, language_code: 'vi', state: 'FAILED', progress: 0, error: 'Dữ liệu minh họa: chưa kết nối dịch vụ TTS.', retry_count: 0, created_by: actorId, created_at, started_at: created_at, finished_at: created_at }], audit: [],
    grants: { 'Super Admin': [...permissions], Admin: ['poi.write', 'zone.write', 'language.write', 'audio.write', 'analytics.read', 'audit.read'], 'POI Manager': ['poi.write', 'audio.write'], User: [] }, events,
    density: Array.from({ length: 72 }, (_, index) => ({ poi_id: pois[index % 3].id, hour_bucket: new Date(new Date().setHours(Math.floor(index / 3), 0, 0, 0)).toISOString(), visit_count: (index * 7) % 24 })).filter(row => row.hour_bucket <= created_at), defaultRadius: 30,
  }
}

function load(): { data: Data; error: string } {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return { data: seed(), error: '' }
    const data = JSON.parse(saved) as Data
    if (!['languages', 'zones', 'pois', 'accounts', 'tasks', 'audit', 'events', 'density'].every(key => Array.isArray(data[key as keyof Data])) || !roleNames.every(role => Array.isArray(data.grants?.[role])) || !Number.isFinite(data.defaultRadius)) throw new Error('Invalid data')
    return { data, error: '' }
  } catch { return { data: seed(), error: 'Không đọc được dữ liệu cục bộ. Đang dùng dữ liệu mẫu; bản lưu cũ chưa bị ghi đè.' } }
}

type Store = { data: Data; role: Role; setRole: (role: Role) => void; can: (permission: Permission) => boolean; error: string; commit: (permission: Permission, action: string, target: string, before: unknown, after: unknown, change: (data: Data) => Data) => boolean }
const Context = createContext<Store | null>(null)
function auditSnapshot(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('data:image/')) return `[Ảnh nhúng: ${Math.round(value.length * 0.75 / 1024)} KB]`
  if (Array.isArray(value)) return value.map(auditSnapshot)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, auditSnapshot(item)]))
  return value
}
export function AdminProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(load)
  const [data, setData] = useState(initial.data)
  const [error, setError] = useState(initial.error)
  const [role, setRole] = useState<Role>('Super Admin')
  const can = (permission: Permission) => data.grants[role].includes(permission)
  const commit: Store['commit'] = (permission, action, target, before, after, change) => {
    if (!can(permission)) { setError('Vai trò hiện tại không có quyền thực hiện thao tác này.'); return false }
    const next = change(data)
    next.audit = [{ id: uid(), actor_user_id: actorId, actor_role: role, action, target_id: target, before: auditSnapshot(before), after: auditSnapshot(after), created_at: stamp() }, ...data.audit]
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { setError('Không lưu được dữ liệu. Bộ nhớ trình duyệt bị chặn hoặc đã đầy; thay đổi chưa được áp dụng.'); return false }
    setData(next); setError(''); return true
  }
  return <Context.Provider value={{ data, role, setRole, can, commit, error }}>{children}</Context.Provider>
}
export function useAdmin() { const store = useContext(Context); if (!store) throw new Error('AdminProvider is required'); return store }
