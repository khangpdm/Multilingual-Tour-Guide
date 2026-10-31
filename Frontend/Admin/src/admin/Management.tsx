import { useState, type FormEvent } from 'react'
import { activeTask, api, dateLabel, enqueue, permissionGroups, poiName, stamp, uid, useAdmin, type Account, type AudioTask, type Audit, type Language, type Permission, type Role } from './store'
import { CrudDialog, downloadApi, downloadCsv, Empty, Field, Heading, Notice, saveBlob, Status, usePagination } from './ui'

export function AudioTasks() {
  const { data, can, mutate, busy, mode } = useAdmin()
  const [status, setStatus] = useState('')
  const [locale, setLocale] = useState('')
  const [poiId, setPoiId] = useState('')
  const [message, setMessage] = useState('')
  const pagination = usePagination(data.tasks.filter(task => (!status || task.status === status) && (!locale || task.language_code === locale) && (!poiId || task.poi_id === poiId)).sort((first, second) => second.created_at.localeCompare(first.created_at)))
  async function change(task: AudioTask, retry: boolean) {
    if (!retry && !window.confirm('Hủy tác vụ này? Kết quả đang xử lý sẽ bị bỏ.')) return
    try {
      if (retry && data.tasks.some(other => other.task_id !== task.task_id && other.poi_id === task.poi_id && other.language_code === task.language_code && activeTask(other))) throw new Error('Đã có tác vụ đang hoạt động cho POI/ngôn ngữ này.')
      await mutate({ permission: retry ? 'audio.retry_task' : 'audio.cancel_task', path: `/admin/audio-tasks/${task.task_id}/${retry ? 'retry' : 'cancel'}`, action: retry ? 'audio.retry_task' : 'audio.cancel_task', target: task.task_id, before: { status: task.status }, after: { status: retry ? 'queued' : 'cancelled' }, demo: current => ({ ...current, tasks: current.tasks.map(item => item.task_id === task.task_id ? { ...item, status: retry ? 'queued' : 'cancelled', retry_count: retry ? 0 : item.retry_count, progress: retry ? 0 : item.progress, error: retry ? null : item.error, started_at: retry ? null : item.started_at, finished_at: retry ? null : stamp() } : item) }) }); setMessage(retry ? 'Đã xếp hàng lại, bộ đếm retry được đặt về 0.' : 'Đã hủy tác vụ.')
    } catch (error) { setMessage((error as Error).message) }
  }
  return <><Heading title="Tác vụ audio" detail={mode === 'live' ? 'Cập nhật tiến độ qua SSE; kết nối lại tự nhận snapshot.' : 'Theo dõi trạng thái và tiến độ xử lý audio.'} />{message && <Notice>{message}</Notice>}<section className="panel"><div className="filter-row"><select className="select-control" aria-label="Trạng thái tác vụ" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{['queued', 'processing', 'completed', 'failed', 'cancelled'].map(value => <option key={value}>{value}</option>)}</select><select className="select-control" aria-label="Ngôn ngữ tác vụ" value={locale} onChange={event => setLocale(event.target.value)}><option value="">Tất cả ngôn ngữ</option>{[...new Set(data.tasks.map(task => task.language_code))].map(value => <option key={value}>{value}</option>)}</select><input className="select-control" aria-label="Lọc POI ID" placeholder="POI ID" value={poiId} onChange={event => setPoiId(event.target.value)} /></div><div className="table-wrap"><table><thead><tr><th>POI / Ngôn ngữ</th><th>Trạng thái</th><th>Tiến độ</th><th>Thông tin</th><th /></tr></thead><tbody>{pagination.rows.map(task => <tr key={task.task_id}><td>{data.pois.some(poi => poi.poi_id === task.poi_id) ? poiName(data.pois.find(poi => poi.poi_id === task.poi_id)) : task.poi_id}<small className="admin-block">{task.language_code} · {task.task_id}</small></td><td><Status value={task.status} /></td><td><progress max="100" value={task.progress} aria-label="Tiến độ" /><small>{task.progress}% · Retry {task.retry_count}</small></td><td><small>Tạo: {dateLabel(task.created_at)}<br />Bắt đầu: {dateLabel(task.started_at)}<br />Kết thúc: {dateLabel(task.finished_at)}<br />Người tạo: {task.created_by || 'On-demand (GĐ2)'}</small>{task.error && <p className="admin-error">{task.error}</p>}</td><td>{['failed', 'cancelled'].includes(task.status) && can('audio.retry_task') && <button className="text-button" disabled={busy} onClick={() => void change(task, true)}>Thử lại</button>}{activeTask(task) && can('audio.cancel_task') && <button className="text-button" disabled={busy} onClick={() => void change(task, false)}>Hủy</button>}</td></tr>)}</tbody></table></div>{!pagination.rows.length && <Empty />}{pagination.controls}</section></>
}
export function AuditLogs() {
  const { data, mode, can } = useAdmin()
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [target, setTarget] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [format, setFormat] = useState('csv')
  const [remote, setRemote] = useState<Audit[] | null>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  function params() { const query = new URLSearchParams(); if (actor) query.set('actor', actor); if (action) query.set('action', action); if (target) query.set('target_id', target); if (from) query.set('from', new Date(`${from}T00:00:00+07:00`).toISOString()); if (to) query.set('to', new Date(`${to}T23:59:59.999+07:00`).toISOString()); return query }
  const rows = (mode === 'live' ? remote ?? data.audit : data.audit.filter(log => (!actor || log.actor_user_id === actor) && (!action || log.action === action) && (!target || log.target_id === target) && (!from || new Date(log.timestamp) >= new Date(`${from}T00:00:00+07:00`)) && (!to || new Date(log.timestamp) <= new Date(`${to}T23:59:59.999+07:00`)))).slice().sort((first, second) => second.timestamp.localeCompare(first.timestamp))
  const pagination = usePagination(rows)
  async function search(event: FormEvent) {
    event.preventDefault(); if (from && to && from > to) { setMessage('Ngày bắt đầu phải trước ngày kết thúc.'); return }
    setPending(true); setMessage('')
    try { if (mode === 'live') { const items: Audit[] = []; const query = params(); query.set('page_size', '100'); for (let page = 1; ; page++) { query.set('page', String(page)); const result = await api<{ items: Audit[]; total: number }>(`/admin/audit-logs?${query}`); items.push(...result.items); if (items.length >= result.total || !result.items.length) break } setRemote(items) } } catch (error) { setMessage((error as Error).message) } finally { setPending(false) }
  }
  async function exportLogs() {
    if (from && to && from > to) { setMessage('Khoảng ngày không hợp lệ.'); return }
    setPending(true); setMessage('')
    try {
      if (rows.length > 100000) throw new Error('Tối đa 100.000 dòng. Hãy thu hẹp khoảng thời gian.')
      if (mode === 'live') { const query = params(); query.set('format', format); await downloadApi(`/admin/audit-logs/export?${query}`, `audit-logs.${format}`) }
      else if (format === 'json') saveBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), 'demo-audit-logs.json')
      else downloadCsv('demo-audit-logs.csv', [['timestamp', 'actor_user_id', 'action', 'target_id', 'before', 'after'], ...rows.map(log => [log.timestamp, log.actor_user_id, log.action, log.target_id, JSON.stringify(log.before), JSON.stringify(log.after)])])
    } catch (error) { setMessage((error as Error).message) } finally { setPending(false) }
  }
  return <><Heading title="Nhật ký thao tác" detail="Chỉ đọc. UTC+7; mặc định API trả 30 ngày gần nhất. Không chứa mật khẩu, token hoặc PII.">{can('audit.export') && <><select className="select-control" aria-label="Định dạng xuất" value={format} onChange={event => setFormat(event.target.value)}><option value="csv">CSV</option><option value="json">JSON</option></select><button className="secondary-button" disabled={pending} onClick={() => void exportLogs()}>Xuất nhật ký</button></>}</Heading><section className="panel"><form className="filter-row" onSubmit={search}><input className="select-control" aria-label="Người thực hiện" placeholder="User ID" value={actor} onChange={event => setActor(event.target.value)} /><input className="select-control" aria-label="Hành động" placeholder="Ví dụ: poi.update" value={action} onChange={event => setAction(event.target.value)} /><input className="select-control" aria-label="Đối tượng" placeholder="Target ID" value={target} onChange={event => setTarget(event.target.value)} /><Field label="Từ ngày"><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field><Field label="Đến ngày"><input type="date" min={from} value={to} onChange={event => setTo(event.target.value)} /></Field><button className="primary-button" disabled={pending}>Áp dụng</button></form>{message && <Notice>{message}</Notice>}{pagination.rows.map(log => <details className="audit-entry" key={log.log_id}><summary><strong>{log.action}</strong><span>{log.actor_email || log.actor_user_id}</span><time>{dateLabel(log.timestamp)}</time></summary><p>{log.target_id}</p><div className="admin-diff"><div><h3>Trước</h3><pre>{JSON.stringify(log.before, null, 2)}</pre></div><div><h3>Sau</h3><pre>{JSON.stringify(log.after, null, 2)}</pre></div></div></details>)}{!rows.length && <Empty />}{pagination.controls}</section></>
}
export function Languages() {
  const { data, can, mutate, user, busy } = useAdmin()
  const [draft, setDraft] = useState<Language | null>(null)
  const [originalCode, setOriginalCode] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  function open(language?: Language) { setOriginalCode(language?.code || null); setDraft(language ? { ...language } : { code: '', name: '', native_name: '', is_active: false, is_default: false, display_order: data.languages.length + 1 }); setMessage('') }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft) return
    try {
      if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(draft.code)) throw new Error('Mã ngôn ngữ hợp lệ: vi, en, zh-CN. Giữ đúng chữ hoa phần vùng.')
      if (!originalCode && data.languages.some(language => language.code === draft.code)) throw new Error('Mã ngôn ngữ đã tồn tại.')
      if (draft.code === 'vi' && !draft.is_active) throw new Error('Tiếng Việt là ngôn ngữ gốc, không thể tắt.')
      if (!draft.is_default && !data.languages.some(language => language.code !== draft.code && language.is_default)) throw new Error('Cần đúng một ngôn ngữ mặc định. Chọn ngôn ngữ khác làm mặc định trước.')
      const before = data.languages.find(language => language.code === originalCode)
      const { code, ...fields } = draft
      const body = originalCode ? fields : { code, name: draft.name, native_name: draft.native_name, is_active: draft.is_active, display_order: draft.display_order }
      await mutate({ permission: 'system.manage_languages', path: originalCode ? `/admin/languages/${originalCode}` : '/admin/languages', method: originalCode ? 'PUT' : 'POST', body, action: originalCode ? 'language.update' : 'language.create', target: code, before, after: body, demo: current => {
        let next = { ...current, languages: [...current.languages.filter(language => language.code !== code).map(language => draft.is_default ? { ...language, is_default: false } : language), draft] }
        if (draft.is_active && !before?.is_active) for (const poi of next.pois.filter(poi => poi.status === 'published' && !poi.content[code]?.audio_url)) next = enqueue(next, poi, [code], user!.user_id)
        if (!draft.is_active) next.tasks = next.tasks.map(task => task.language_code === code && activeTask(task) ? { ...task, status: 'cancelled' } : task)
        return next
      } }); setDraft(null); setMessage('Đã lưu. Bật ngôn ngữ sẽ bổ sung audio còn thiếu; tắt ngôn ngữ sẽ hủy tác vụ chưa kết thúc.')
    } catch (error) { setMessage((error as Error).message) }
  }
  return <><Heading title="Ngôn ngữ" detail="Tiếng Việt luôn là ngôn ngữ gốc. Chỉ một ngôn ngữ mặc định.">{can('system.manage_languages') && <button className="primary-button" onClick={() => open()}>+ Thêm ngôn ngữ</button>}</Heading>{message && !draft && <Notice>{message}</Notice>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Mã</th><th>Ngôn ngữ</th><th>Thứ tự</th><th>Trạng thái</th><th /></tr></thead><tbody>{[...data.languages].sort((first, second) => first.display_order - second.display_order).map(language => <tr key={language.code}><td>{language.code}</td><td><strong>{language.native_name}</strong><small className="admin-block">{language.name}{language.is_default ? ' · Mặc định' : ''}{language.code === 'vi' ? ' · Ngôn ngữ gốc' : ''}</small></td><td>{language.display_order}</td><td><Status value={language.is_active ? 'active' : 'inactive'} /></td><td>{can('system.manage_languages') && <button className="text-button" onClick={() => open(language)}>Sửa</button>}</td></tr>)}</tbody></table></div></section>{draft && <CrudDialog title={originalCode ? 'Chỉnh sửa ngôn ngữ' : 'Thêm ngôn ngữ'} onClose={() => { if (!busy) setDraft(null) }}><form className="admin-form" onSubmit={save}><fieldset disabled={busy}><Field label="Mã ngôn ngữ"><input required pattern="[a-z]{2,3}(-[A-Z]{2})?" disabled={Boolean(originalCode)} value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value.trim() })} /></Field><Field label="Tên tiếng Anh"><input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Tên bản địa"><input required value={draft.native_name} onChange={event => setDraft({ ...draft, native_name: event.target.value })} /></Field><Field label="Thứ tự"><input required type="number" min="0" step="1" value={draft.display_order} onChange={event => setDraft({ ...draft, display_order: event.target.valueAsNumber })} /></Field><label className="admin-check"><input type="checkbox" disabled={draft.code === 'vi'} checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} />Đang bật</label>{originalCode && <label className="admin-check"><input type="checkbox" checked={draft.is_default} onChange={event => setDraft({ ...draft, is_default: event.target.checked })} />Làm ngôn ngữ mặc định</label>}<Notice>Bật: xếp hàng tạo nội dung/audio thiếu. Tắt: ẩn locale khỏi app, giữ dữ liệu và hủy tác vụ đang chạy.</Notice><button className="primary-button">Lưu ngôn ngữ</button></fieldset>{message && <Notice>{message}</Notice>}</form></CrudDialog>}</>
}

export function Roles() {
  const { data, user, can, level, mutate, busy } = useAdmin()
  const [draft, setDraft] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  function open(role?: Role) { setCreating(!role); setDraft(role ? structuredClone(role) : { role_id: '', name: '', level: 1, permissions: [], is_system: false }); setMessage('') }
  const allowed = (role: Role) => role.role_id !== 'super_admin' && role.role_id !== 'user' && can('role.assign_permission') && (user?.role_id === 'super_admin' || role.level < level)
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft) return
    try {
      const original = data.roles.find(role => role.role_id === draft.role_id)
      if (creating && (original || !/^[a-z][a-z0-9_]{2,31}$/.test(draft.role_id) || draft.level > level)) throw new Error('Role ID phải duy nhất, 3–32 ký tự; cấp không vượt cấp của bạn.')
      const grant = draft.permissions.filter(permission => !original?.permissions.includes(permission))
      const revoke = original?.permissions.filter(permission => !draft.permissions.includes(permission)) || []
      if (grant.some(permission => !can(permission))) throw new Error('Không thể cấp quyền mà bạn không có.')
      if (!creating && (!original || !allowed(original))) throw new Error('Không được sửa quyền của vai trò này.')
      const body = creating ? { role_id: draft.role_id, name: draft.name, level: draft.level, permission_ids: draft.permissions } : { grant, revoke }
      await mutate({ permission: creating ? 'role.create' : 'role.assign_permission', path: creating ? '/admin/roles' : `/admin/roles/${draft.role_id}/permissions`, body, action: creating ? 'role.create' : 'role.assign_permission', target: draft.role_id, before: original?.permissions, after: draft.permissions, demo: current => ({ ...current, roles: creating ? [...current.roles, draft] : current.roles.map(role => role.role_id === draft.role_id ? draft : role) }) }); setDraft(null); setMessage('Đã lưu vai trò và quyền.')
    } catch (error) { setMessage((error as Error).message) }
  }
  return <><Heading title="Vai trò & quyền" detail="32 quyền thuộc 9 nhóm. Super Admin luôn toàn quyền; du khách không có quyền.">{can('role.create') && <button className="primary-button" onClick={() => open()}>+ Tạo vai trò</button>}</Heading>{message && !draft && <Notice>{message}</Notice>}<div className="zone-grid">{data.roles.map(role => <section className="panel" key={role.role_id}><h2>{role.name}</h2><p>{role.role_id} · Cấp {role.level}{role.is_system ? ' · Vai trò hệ thống' : ''}</p><p>{role.role_id === 'super_admin' ? 'Toàn bộ quyền' : `${role.permissions.length} quyền`}</p><button className="text-button" onClick={() => open(role)}>{allowed(role) ? 'Chỉnh sửa quyền' : 'Xem quyền'}</button></section>)}</div>{draft && <CrudDialog title={creating ? 'Tạo vai trò' : draft.name} onClose={() => { if (!busy) setDraft(null) }}><form className="admin-form" onSubmit={save}>{creating && <><Field label="Role ID"><input required pattern="[a-z][a-z0-9_]{2,31}" value={draft.role_id} onChange={event => setDraft({ ...draft, role_id: event.target.value })} /></Field><Field label="Tên vai trò"><input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Cấp"><select value={draft.level} onChange={event => setDraft({ ...draft, level: Number(event.target.value) })}>{[1, 2].filter(value => value <= level).map(value => <option key={value}>{value}</option>)}</select></Field></>}{Object.entries(permissionGroups).map(([group, groupPermissions]) => <fieldset key={group} className="permission-group"><legend>{group}</legend>{groupPermissions.map(permission => <label className="admin-check" key={permission}><input type="checkbox" disabled={busy || (!creating && !allowed(draft)) || (!draft.permissions.includes(permission) && !can(permission))} checked={draft.role_id === 'super_admin' || draft.permissions.includes(permission)} onChange={event => setDraft({ ...draft, permissions: event.target.checked ? [...draft.permissions, permission] : draft.permissions.filter(value => value !== permission) })} />{permission}</label>)}</fieldset>)}{(creating || allowed(draft)) && <button className="primary-button" disabled={busy}>Lưu quyền</button>}{message && <Notice>{message}</Notice>}</form></CrudDialog>}</>
}

export function Accounts() {
  const { data, user, can, level, mutate, mode, busy } = useAdmin()
  const [draft, setDraft] = useState<Account | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const [deactivating, setDeactivating] = useState<Account | null>(null)
  const roleLevel = (roleId: string) => data.roles.find(role => role.role_id === roleId)?.level ?? ({ super_admin: 3, admin: 2, poi_manager: 1 } as Record<string, number>)[roleId] ?? Infinity
  const choices = data.roles.filter(role => role.role_id !== 'user' && role.level <= level)
  const pagination = usePagination(data.accounts.filter(account => `${account.email} ${account.full_name || ''}`.toLowerCase().includes(query.toLowerCase()) && (!roleFilter || account.role_id === roleFilter) && (!status || account.status === status)))
  function open(account?: Account) { setCreating(!account); setMessage(''); setDraft(account ? { ...account } : { user_id: uid('user'), email: '', full_name: '', role_id: 'poi_manager', status: 'pending_activation', created_at: stamp(), invite_expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }) }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft) return
    try {
      if (roleLevel(draft.role_id) > level || draft.role_id === 'user') throw new Error('Không được gán vai trò này.')
      const original = data.accounts.find(account => account.user_id === draft.user_id)
      if (!creating && original && (roleLevel(original.role_id) > level || (mode === 'live' && original.user_id === user?.user_id && original.role_id !== draft.role_id))) throw new Error('Không được đổi vai trò của chính mình hoặc người cấp cao hơn.')
      if (creating && data.accounts.some(account => account.email.toLowerCase() === draft.email.trim().toLowerCase())) throw new Error('Email đã tồn tại.')
      const body = creating ? { email: draft.email.trim(), role_id: draft.role_id, full_name: draft.full_name } : { full_name: draft.full_name, ...(original?.role_id !== draft.role_id ? { role_id: draft.role_id } : {}) }
      await mutate({ permission: creating ? 'user.create' : 'user.edit', path: creating ? '/admin/users/invite' : `/admin/users/${draft.user_id}`, method: creating ? 'POST' : 'PUT', body, action: creating ? 'user.invite' : 'user.update', target: draft.user_id, before: original ? { role_id: original.role_id } : null, after: { role_id: draft.role_id, status: draft.status }, demo: current => ({ ...current, accounts: creating ? [...current.accounts, { ...draft, email: draft.email.trim() }] : current.accounts.map(account => account.user_id === draft.user_id ? draft : account) }) }); setDraft(null); setMessage(creating ? mode === 'demo' ? 'Đã lưu lời mời.' : 'Đã tiếp nhận lời mời. Người dùng kích hoạt bằng liên kết gửi qua email.' : 'Đã cập nhật tài khoản.')
    } catch (error) { setMessage((error as Error).message) }
  }
  async function deactivate() {
    if (!deactivating) return
    try {
      if (deactivating.user_id === user?.user_id || roleLevel(deactivating.role_id) > level || (deactivating.role_id === 'super_admin' && data.accounts.filter(account => account.role_id === 'super_admin' && account.status === 'active').length <= 1)) throw new Error('Không thể vô hiệu hóa bản thân, người cấp cao hơn hoặc Super Admin hoạt động cuối cùng.')
      await mutate({ permission: 'user.deactivate', path: `/admin/users/${deactivating.user_id}/deactivate`, method: 'PUT', action: 'user.deactivate', target: deactivating.user_id, before: { status: deactivating.status }, after: { status: 'deactivated' }, demo: current => ({ ...current, accounts: current.accounts.map(account => account.user_id === deactivating.user_id ? { ...account, status: 'deactivated' } : account) }) }); setDeactivating(null); setMessage('Đã vô hiệu hóa tài khoản.')
    } catch (error) { setMessage((error as Error).message) }
  }
  return <><Heading title="Tài khoản quản trị" detail="Mời qua email; không tạo tài khoản du khách, không kích hoạt bằng tay.">{can('user.create') && <button className="primary-button" onClick={() => open()}>+ Mời thành viên</button>}</Heading>{message && !draft && !deactivating && <Notice>{message}</Notice>}<section className="panel"><div className="filter-row"><input className="select-control" aria-label="Tìm tài khoản" placeholder="Email hoặc họ tên…" value={query} onChange={event => setQuery(event.target.value)} /><select className="select-control" aria-label="Vai trò" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="">Tất cả vai trò</option>{[...new Set(data.accounts.map(account => account.role_id))].map(role => <option key={role}>{role}</option>)}</select><select className="select-control" aria-label="Trạng thái" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="pending_activation">Chờ kích hoạt</option><option value="active">Hoạt động</option><option value="deactivated">Vô hiệu hóa</option></select></div><div className="table-wrap"><table><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th>Thông tin</th><th /></tr></thead><tbody>{pagination.rows.map(account => <tr key={account.user_id}><td><strong>{account.full_name || 'Chưa có tên'}</strong><small className="admin-block">{account.email}</small></td><td>{account.role_id}</td><td><Status value={account.status} /></td><td><small>Tạo: {dateLabel(account.created_at)}<br />Đăng nhập: {dateLabel(account.last_login_at)}{account.invite_expires_at && <><br />Hạn lời mời: {dateLabel(account.invite_expires_at)}</>}</small></td><td>{can('user.edit') && roleLevel(account.role_id) <= level && <button className="text-button" onClick={() => open(account)}>Sửa</button>}{can('user.deactivate') && account.user_id !== user?.user_id && account.status !== 'deactivated' && roleLevel(account.role_id) <= level && <button className="text-button" onClick={() => { setMessage(''); setDeactivating(account) }}>Vô hiệu hóa</button>}</td></tr>)}</tbody></table></div>{pagination.controls}</section>{draft && <CrudDialog title={creating ? 'Mời thành viên' : 'Sửa tài khoản'} onClose={() => { if (!busy) setDraft(null) }}><form className="admin-form" onSubmit={save}><Field label="Email (không thể đổi sau khi mời)"><input type="email" required disabled={!creating} value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></Field><Field label="Họ tên"><input value={draft.full_name || ''} onChange={event => setDraft({ ...draft, full_name: event.target.value })} /></Field><Field label="Vai trò"><select disabled={mode === 'live' && draft.user_id === user?.user_id} value={draft.role_id} onChange={event => setDraft({ ...draft, role_id: event.target.value })}>{!choices.some(role => role.role_id === draft.role_id) && <option value={draft.role_id}>{draft.role_id}</option>}{choices.map(role => <option key={role.role_id} value={role.role_id}>{role.name} · Cấp {role.level}</option>)}</select></Field><Status value={draft.status} />{creating && <Notice>Lời mời có hiệu lực 7 ngày theo cấu hình mặc định. Người được mời tự đặt mật khẩu trên trang kích hoạt.</Notice>}<button className="primary-button" disabled={busy}>{creating ? 'Gửi lời mời' : 'Lưu thay đổi'}</button>{message && <Notice>{message}</Notice>}</form></CrudDialog>}{deactivating && <CrudDialog title="Vô hiệu hóa tài khoản" onClose={() => { if (!busy) setDeactivating(null) }}><p>{deactivating.email} sẽ bị từ chối truy cập ngay, kể cả token chưa hết hạn.</p><button className="danger-button" disabled={busy} onClick={() => void deactivate()}>Xác nhận vô hiệu hóa</button>{message && <Notice>{message}</Notice>}</CrudDialog>}</>
}
