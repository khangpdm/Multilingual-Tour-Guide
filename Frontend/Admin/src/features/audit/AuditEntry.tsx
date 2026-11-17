import { useState } from 'react'
import { assetUrl } from '../../admin/api'
import { dateLabel, poiName, useAdmin } from '../../admin/store'
import type { Audit, Data } from '../../admin/types'
import { CrudDialog } from '../../shared/ui'
import { categories } from '../places/PoiReview'
import { auditActions, auditChanges, auditFieldLabel } from './presentation'

const valueNames: Record<string, string> = {
  active: 'Hoạt động', inactive: 'Không hoạt động', archived: 'Đã lưu trữ',
  deactivated: 'Vô hiệu hóa', pending_activation: 'Chờ kích hoạt',
  queued: 'Chờ xử lý', processing: 'Đang xử lý', completed: 'Hoàn tất', failed: 'Thất bại',
  cancelled: 'Đã hủy', ready: 'Sẵn sàng', published: 'Đã phát hành', superseded: 'Đã được thay thế / thu hồi',
  UPLOADED: 'MP3 tải lên', TTS: 'Giọng đọc tự động',
}

function AuditValue({ path, value, data }: { path: string; value: unknown; data: Data }) {
  const field = path.split('.').at(-1) || ''
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return <span className="history-empty">Chưa có</span>
  if (typeof value === 'boolean') return <>{value ? 'Có' : 'Không'}</>
  if (Array.isArray(value)) return <ul className="audit-value-list">{value.map((item, index) => <li key={index}><AuditValue path={path} value={item} data={data} /></li>)}</ul>
  const text = String(value)
  if (field === 'images' || field === 'cover_image') return <img className="audit-image" src={assetUrl(text)} alt={field === 'cover_image' ? 'Ảnh đại diện đã lưu' : 'Ảnh đã lưu'} loading="lazy" />
  if (field === 'audio_url') return <audio aria-label="Audio đã lưu" controls preload="none" src={assetUrl(text)} />
  if (field === 'zone_id') return <>{data.zones.find(zone => zone.zone_id === text)?.name || 'Khu vực không còn trong danh sách'}</>
  if (field === 'role_id') return <>{data.roles.find(role => role.role_id === text)?.name || 'Vai trò không còn trong danh sách'}</>
  if (field === 'category') return <>{categories[text] || text}</>
  if (['status', 'state', 'audio_source'].includes(field)) return <>{valueNames[text] || valueNames[text.toLowerCase()] || text}</>
  if (['code', 'language_code', 'locales'].includes(field)) return <>{data.languages.find(language => language.code === text)?.native_name || text}</>
  if (field === 'locked_until') return <>{dateLabel(text)}</>
  if (field === 'permissions' || (path === 'value' && text.includes('.'))) return <>{auditActions[text] || auditFieldLabel(text, [])}</>
  return <>{text}</>
}

function targetLabel(log: Audit, data: Data) {
  const poi = data.pois.find(item => item.poi_id === log.target_id)
  if (poi) return poiName(poi)
  const zone = data.zones.find(item => item.zone_id === log.target_id)
  if (zone) return zone.name
  const account = data.accounts.find(item => item.user_id === log.target_id)
  if (account) return account.full_name || account.email
  const role = data.roles.find(item => item.role_id === log.target_id)
  if (role) return role.name
  const language = data.languages.find(item => item.code === log.target_id)
  if (language) return language.native_name
  if (log.target_id === 'geofence_radius_m') return 'Bán kính nhận diện chung'
  if (log.action.startsWith('offline.')) return 'Gói offline'
  if (log.action.startsWith('audio.')) return 'Tác vụ audio'
  if (log.action.startsWith('poi.')) return 'Địa điểm không còn trong danh sách'
  return 'Đối tượng được ghi nhận trong nhật ký'
}

export function AuditEntry({ log }: { log: Audit }) {
  const { data } = useAdmin()
  const [open, setOpen] = useState(false)
  const changes = auditChanges(log.before, log.after)
  const actor = data.accounts.find(account => account.user_id === log.actor_user_id)
  const action = auditActions[log.action] || auditFieldLabel(log.action, [])
  const actorName = actor?.full_name || log.actor_email || actor?.email || 'Tài khoản không còn trong danh sách'
  return <div className="audit-entry">
    <button type="button" className="record-row" aria-haspopup="dialog" onClick={() => setOpen(true)}><span className="record-row-title"><strong>{action}</strong><span>{actorName} · {dateLabel(log.timestamp)}</span></span><span className="record-row-action">Xem chi tiết →</span></button>
    {open && <CrudDialog title="Chi tiết nhật ký thao tác" size="wide" onClose={() => setOpen(false)}>
    <div className="record-dialog-meta"><p><strong>Thao tác:</strong> {action}</p><p><strong>Người thực hiện:</strong> {actorName}</p><p><strong>Thời gian:</strong> <time dateTime={log.timestamp}>{dateLabel(log.timestamp)}</time></p></div>
    <p className="audit-target">Đối tượng: <strong>{targetLabel(log, data)}</strong></p>
    {changes.length ? <div className="history-table-scroll" role="region" aria-label="Chi tiết thay đổi trong nhật ký" tabIndex={0}><table className="history-table"><caption>{changes.length} mục được ghi nhận thay đổi</caption><thead><tr><th scope="col">Nội dung</th><th scope="col">Trước thao tác</th><th scope="col">Sau thao tác</th></tr></thead><tbody>{changes.map(change => <tr key={change.path}><th scope="row">{auditFieldLabel(change.path, data.languages)}</th><td><AuditValue path={change.path} value={change.before} data={data} /></td><td><AuditValue path={change.path} value={change.after} data={data} /></td></tr>)}</tbody></table></div> : <p className="admin-block">Thao tác đã được ghi nhận, không có nội dung thay đổi kèm theo.</p>}
    <div className="record-dialog-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Đóng</button></div>
    </CrudDialog>}
  </div>
}
