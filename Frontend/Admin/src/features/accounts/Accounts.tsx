import { toast } from 'sonner'
import { useState, type FormEvent } from 'react'
import { activeTask, dateLabel, enqueue, poiName, stamp, uid, useAdmin } from '../../admin/store'
import { permissionGroups, type Account, type AudioTask, type Audit, type Language, type Permission, type Role } from '../../admin/types'
import { api } from '../../admin/api'
import { CrudDialog, downloadApi, downloadCsv, Empty, Field, Heading, Notice, saveBlob, Status, usePagination } from '../../shared/ui'

type Delivery = { delivery: 'sent' | 'failed' }
type Invitation = Delivery & { username: string; activation_path: string }

export function Accounts() {
  const { data, user, can, level, mutate, mode, busy } = useAdmin()
  const [draft, setDraft] = useState<Account | null>(null)
  const [creating, setCreating] = useState(false)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [status, setStatus] = useState('')

  const [reissuing, setReissuing] = useState<Account | null>(null)
  const [accountAction, setAccountAction] = useState<{ account: Account; action: 'lock' | 'unlock' | 'send-password-reset' } | null>(null)
  const [deactivating, setDeactivating] = useState<Account | null>(null)
  const roleLevel = (roleId: string) => data.roles.find(role => role.role_id === roleId)?.level ?? ({ super_admin: 3, admin: 2, poi_manager: 1 } as Record<string, number>)[roleId] ?? Infinity
  const choices = data.roles.filter(role => (mode === 'demo' || ['poi_manager', 'admin', 'super_admin'].includes(role.role_id)) && role.level > 0 && (user?.role_id === 'super_admin' || role.level < level))
  const pagination = usePagination(data.accounts.filter(account => `${account.email} ${account.username || ''} ${account.full_name || ''}`.toLowerCase().includes(query.toLowerCase()) && (!roleFilter || account.role_id === roleFilter) && (!status || account.status === status)))
  function open(account?: Account) { setCreating(!account); setDraft(account ? { ...account } : { user_id: uid('user'), email: '', full_name: '', role_id: choices.find(role => role.role_id !== 'super_admin')?.role_id || choices[0]?.role_id || '', status: 'pending_activation', created_at: stamp(), invite_expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }) }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft) return
    try {
      if (roleLevel(draft.role_id) > level || draft.role_id === 'user') throw new Error('Không được gán vai trò này.')
      const original = data.accounts.find(account => account.user_id === draft.user_id)
      if (!creating && original && (roleLevel(original.role_id) > level || (mode === 'live' && original.user_id === user?.user_id && original.role_id !== draft.role_id))) throw new Error('Không được đổi vai trò của chính mình hoặc người cấp cao hơn.')
      if (creating && data.accounts.some(account => account.email.toLowerCase() === draft.email.trim().toLowerCase())) throw new Error('Email đã tồn tại.')
      const body = creating ? { email: draft.email.trim(), role_id: draft.role_id, full_name: draft.full_name } : { full_name: draft.full_name, ...(original?.role_id !== draft.role_id ? { role_id: draft.role_id } : {}) }
      const result = await mutate<Invitation>({ permission: creating ? 'user.create' : 'user.edit', path: creating ? '/admin/users/invite' : `/admin/users/${draft.user_id}`, method: creating ? 'POST' : 'PUT', body, action: creating ? 'user.invite' : 'user.update', target: draft.user_id, before: original ? { role_id: original.role_id } : null, after: { role_id: draft.role_id, status: draft.status }, demo: current => ({ ...current, accounts: creating ? [...current.accounts, { ...draft, email: draft.email.trim() }] : current.accounts.map(account => account.user_id === draft.user_id ? draft : account) }) }); setDraft(null); if (creating && result?.activation_path) setInvitation(result); if (result?.delivery === 'failed') toast.warning('Đã lưu tài khoản. Gửi email thất bại, bạn có thể cấp lại link.')
      else toast.success(creating ? mode === 'demo' ? 'Đã lưu lời mời demo.' : 'Đã tạo tài khoản và gửi email thiết lập mật khẩu.' : 'Đã cập nhật tài khoản.')
    } catch (error) { toast.error((error as Error).message) }
  }
  async function reissueInvitation() {
    if (!reissuing) return
    const userId = reissuing.user_id
    try {
      const result = await mutate<Invitation>({
        permission: 'user.create',
        path: `/admin/users/${encodeURIComponent(userId)}/reissue-invitation`,
        method: 'POST',
        action: 'user.reissue_invitation',
        target: userId,
        demo: current => current,
      })
      if (!result?.activation_path) return
      setReissuing(null)
      setInvitation(result)
      if (result.delivery === 'failed') toast.warning('Đã cấp link mới. Gửi email thất bại, bạn có thể thử lại.')
      else toast.success('Đã cấp link mới và gửi email.')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }
  async function confirmAccountAction() {
    if (!accountAction) return
    const { account, action } = accountAction
    const reset = action === 'send-password-reset'
    try {
      const result = await mutate<Delivery>({
        permission: reset ? 'user.edit' : 'user.deactivate',
        path: `/admin/users/${encodeURIComponent(account.user_id)}/${action}`,
        method: reset ? 'POST' : 'PUT',
        action: reset ? 'user.request_password_reset' : `user.${action}`,
        target: account.user_id,
        demo: current => current,
      })
      setAccountAction(null)
      if (result?.delivery === 'failed') toast.warning('Đã ghi nhận yêu cầu. Gửi email thất bại, bạn có thể thử lại.')
      else toast.success(reset ? 'Đã gửi link đặt lại mật khẩu.' : action === 'lock' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }
  async function deactivate() {
    if (!deactivating) return
    try {
      if (deactivating.user_id === user?.user_id || roleLevel(deactivating.role_id) > level || (deactivating.role_id === 'super_admin' && data.accounts.filter(account => account.role_id === 'super_admin' && account.status === 'active').length <= 1)) throw new Error('Không thể vô hiệu hóa bản thân, người cấp cao hơn hoặc Super Admin hoạt động cuối cùng.')
      await mutate({ permission: 'user.deactivate', path: `/admin/users/${deactivating.user_id}/deactivate`, method: 'PUT', action: 'user.deactivate', target: deactivating.user_id, before: { status: deactivating.status }, after: { status: 'deactivated' }, demo: current => ({ ...current, accounts: current.accounts.map(account => account.user_id === deactivating.user_id ? { ...account, status: 'deactivated' } : account) }) }); setDeactivating(null); toast.success('Đã vô hiệu hóa tài khoản.')
    } catch (error) { toast.error((error as Error).message) }
  }
  const actionLabel = accountAction?.action === 'lock' ? 'Khóa tài khoản' : accountAction?.action === 'unlock' ? 'Mở khóa tài khoản' : 'Gửi link đặt lại mật khẩu'
  return <><Heading title="Tài khoản quản trị" detail="Tạo tài khoản và gửi email để thành viên tự thiết lập mật khẩu.">{can('user.create') && <button className="primary-button" onClick={() => open()}>+ Tạo tài khoản</button>}</Heading><section className="panel"><div className="filter-row"><input className="select-control" aria-label="Tìm tài khoản" placeholder="Email hoặc họ tên…" value={query} onChange={event => setQuery(event.target.value)} /><select className="select-control" aria-label="Vai trò" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="">Tất cả vai trò</option>{[...new Set(data.accounts.map(account => account.role_id))].map(role => <option key={role}>{role}</option>)}</select><select className="select-control" aria-label="Trạng thái" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="pending_activation">Chờ kích hoạt</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option><option value="deactivated">Vô hiệu hóa</option></select></div><div className="table-wrap"><table><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th>Thông tin</th><th /></tr></thead><tbody>{pagination.rows.map(account => <tr key={account.user_id}><td><strong>{account.full_name || 'Chưa có tên'}</strong><small className="admin-block">{account.email}</small><small className="admin-block">{account.username}</small></td><td>{account.role_id}</td><td><Status value={account.status} /></td><td><small>Tạo: {dateLabel(account.created_at)}<br />Đăng nhập: {dateLabel(account.last_login_at)}{account.invite_expires_at && <><br />Hạn lời mời: {dateLabel(account.invite_expires_at)}</>}</small></td><td><div className="account-row-actions">{mode === 'live' && account.status === 'pending_activation' && can('user.create') && (user?.role_id === 'super_admin' || roleLevel(account.role_id) < level) && <button type="button" className="primary-button" disabled={busy} onClick={() => setReissuing(account)}>Cấp lại link</button>}{can('user.edit') && (account.user_id === user?.user_id || user?.role_id === 'super_admin' || roleLevel(account.role_id) < level) && <button type="button" className="secondary-button" onClick={() => open(account)}>Sửa</button>}{mode === 'live' && user?.role_id === 'super_admin' && (account.status === 'active' || account.status === 'locked') && <>{account.user_id !== user.user_id && can('user.deactivate') && <button type="button" className="secondary-button" disabled={busy} onClick={() => setAccountAction({ account, action: account.status === 'locked' ? 'unlock' : 'lock' })}>{account.status === 'locked' ? 'Mở khóa' : 'Khóa'}</button>}{can('user.edit') && <button type="button" className="secondary-button" disabled={busy} onClick={() => setAccountAction({ account, action: 'send-password-reset' })}>Gửi link đặt lại mật khẩu</button>}</>}{can('user.deactivate') && account.user_id !== user?.user_id && account.status !== 'deactivated' && (account.user_id === user?.user_id || user?.role_id === 'super_admin' || roleLevel(account.role_id) < level) && <button type="button" className="danger-button" onClick={() => { setDeactivating(account) }}>Vô hiệu hóa</button>}</div></td></tr>)}</tbody></table></div>{pagination.controls}</section>{invitation && <CrudDialog title="Lời mời đã tạo" onClose={() => setInvitation(null)}><Notice>{invitation.delivery === 'sent' ? 'Đã gửi email thiết lập mật khẩu.' : 'Gửi email thất bại. Bạn có thể cấp lại link để thử gửi lại.'} Liên kết dùng một lần. Chỉ chia sẻ riêng cho người được mời.</Notice><Field label="Tên đăng nhập"><input readOnly value={invitation.username} /></Field><Field label="Liên kết kích hoạt"><input readOnly value={new URL(invitation.activation_path, window.location.origin).href} onFocus={event => event.currentTarget.select()} /></Field></CrudDialog>}{draft && <CrudDialog title={creating ? 'Tạo tài khoản' : 'Sửa tài khoản'} onClose={() => { if (!busy) setDraft(null) }}><form className="admin-form" onSubmit={save}><Field label="Email (không thể đổi sau khi mời)"><input type="email" required disabled={!creating} value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></Field><Field label="Họ tên"><input value={draft.full_name || ''} onChange={event => setDraft({ ...draft, full_name: event.target.value })} /></Field><Field label="Vai trò"><select disabled={mode === 'live' && draft.user_id === user?.user_id} value={draft.role_id} onChange={event => setDraft({ ...draft, role_id: event.target.value })}>{!choices.some(role => role.role_id === draft.role_id) && <option value={draft.role_id}>{draft.role_id}</option>}{choices.map(role => <option key={role.role_id} value={role.role_id}>{role.name} · Cấp {role.level}</option>)}</select></Field><Status value={draft.status} />{creating && <Notice>Người được mời sẽ nhận link qua email để tự thiết lập mật khẩu.</Notice>}<button className="primary-button" disabled={busy}>{creating ? 'Tạo tài khoản' : 'Lưu thay đổi'}</button></form></CrudDialog>}{accountAction && <CrudDialog title={actionLabel} onClose={() => { if (!busy) setAccountAction(null) }}><p>Tài khoản: {accountAction.account.email}</p>{accountAction.action === 'lock' && <Notice>Phiên đăng nhập hiện tại sẽ bị thu hồi.</Notice>}<button type="button" className="primary-button" disabled={busy} onClick={() => void confirmAccountAction()}>Xác nhận</button></CrudDialog>}{reissuing && <CrudDialog title="Cấp lại link kích hoạt" onClose={() => { if (!busy) setReissuing(null) }}><p>Link cũ của {reissuing.email} sẽ hết hiệu lực ngay khi cấp link mới.</p><button className="primary-button" disabled={busy} onClick={() => void reissueInvitation()}>Xác nhận cấp lại</button></CrudDialog>}{deactivating && <CrudDialog title="Vô hiệu hóa tài khoản" onClose={() => { if (!busy) setDeactivating(null) }}><p>{deactivating.email} sẽ bị từ chối truy cập ngay, kể cả token chưa hết hạn.</p><button className="danger-button" disabled={busy} onClick={() => void deactivate()}>Xác nhận vô hiệu hóa</button></CrudDialog>}</>
}
