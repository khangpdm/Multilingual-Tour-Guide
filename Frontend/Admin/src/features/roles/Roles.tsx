import { toast } from 'sonner'
import { useState, type FormEvent } from 'react'
import { activeTask, dateLabel, enqueue, poiName, stamp, uid, useAdmin } from '../../admin/store'
import { permissionGroups, type Account, type AudioTask, type Audit, type Language, type Permission, type Role } from '../../admin/types'
import { api } from '../../admin/api'
import { CrudDialog, downloadApi, downloadCsv, Empty, Field, Heading, saveBlob, Status, usePagination } from '../../shared/ui'

export function Roles() {
  const { data, user, can, level, mutate, busy } = useAdmin()
  const [draft, setDraft] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)

  function open(role?: Role) { setCreating(!role); setDraft(role ? structuredClone(role) : { role_id: '', name: '', level: 1, permissions: [], is_system: false }); }
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
      await mutate({ permission: creating ? 'role.create' : 'role.assign_permission', path: creating ? '/admin/roles' : `/admin/roles/${draft.role_id}/permissions`, body, action: creating ? 'role.create' : 'role.assign_permission', target: draft.role_id, before: original?.permissions, after: draft.permissions, demo: current => ({ ...current, roles: creating ? [...current.roles, draft] : current.roles.map(role => role.role_id === draft.role_id ? draft : role) }) }); setDraft(null); toast.success('Đã lưu vai trò và quyền.')
    } catch (error) { toast.error((error as Error).message) }
  }
  return <><Heading title="Vai trò & quyền" detail="32 quyền thuộc 9 nhóm. Super Admin luôn toàn quyền; du khách không có quyền.">{can('role.create') && <button className="primary-button" onClick={() => open()}>+ Tạo vai trò</button>}</Heading><div className="zone-grid">{data.roles.map(role => <section className="panel" key={role.role_id}><h2>{role.name}</h2><p>{role.role_id} · Cấp {role.level}{role.is_system ? ' · Vai trò hệ thống' : ''}</p><p>{role.role_id === 'super_admin' ? 'Toàn bộ quyền' : `${role.permissions.length} quyền`}</p><button className="text-button" onClick={() => open(role)}>{allowed(role) ? 'Chỉnh sửa quyền' : 'Xem quyền'}</button></section>)}</div>{draft && <CrudDialog title={creating ? 'Tạo vai trò' : draft.name} onClose={() => { if (!busy) setDraft(null) }}><form className="admin-form" onSubmit={save}>{creating && <><Field label="Role ID"><input required pattern="[a-z][a-z0-9_]{2,31}" value={draft.role_id} onChange={event => setDraft({ ...draft, role_id: event.target.value })} /></Field><Field label="Tên vai trò"><input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Cấp"><select value={draft.level} onChange={event => setDraft({ ...draft, level: Number(event.target.value) })}>{[1, 2].filter(value => value <= level).map(value => <option key={value}>{value}</option>)}</select></Field></>}{Object.entries(permissionGroups).map(([group, groupPermissions]) => <fieldset key={group} className="permission-group"><legend>{group}</legend>{groupPermissions.map(permission => <label className="admin-check" key={permission}><input type="checkbox" disabled={busy || (!creating && !allowed(draft)) || (!draft.permissions.includes(permission) && !can(permission))} checked={draft.role_id === 'super_admin' || draft.permissions.includes(permission)} onChange={event => setDraft({ ...draft, permissions: event.target.checked ? [...draft.permissions, permission] : draft.permissions.filter(value => value !== permission) })} />{permission}</label>)}</fieldset>)}{(creating || allowed(draft)) && <button className="primary-button" disabled={busy}>Lưu quyền</button>}</form></CrudDialog>}</>
}

