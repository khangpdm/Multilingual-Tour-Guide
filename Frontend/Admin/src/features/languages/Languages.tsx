import { toast } from 'sonner'
import { useState, type FormEvent } from 'react'
import { activeTask, dateLabel, enqueue, poiName, stamp, uid, useAdmin } from '../../admin/store'
import { permissionGroups, type Account, type AudioTask, type Audit, type Language, type Permission, type Role } from '../../admin/types'
import { api } from '../../admin/api'
import { CrudDialog, downloadApi, downloadCsv, Empty, Field, Heading, Notice, saveBlob, Status, usePagination } from '../../shared/ui'

export function Languages() {
  const { data, can, mutate, user, busy, localDatabase } = useAdmin()
  const [draft, setDraft] = useState<Language | null>(null)
  const [originalCode, setOriginalCode] = useState<string | null>(null)

  function open(language?: Language) { setOriginalCode(language?.code || null); setDraft(language ? { ...language } : { code: '', name: '', native_name: '', is_active: false, is_default: false, display_order: data.languages.length + 1 }); }
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
      } }); setDraft(null); toast.success(localDatabase ? 'Đã lưu cấu hình ngôn ngữ vào MySQL. Chưa bật tạo nội dung/audio tự động.' : 'Đã lưu. Bật ngôn ngữ sẽ bổ sung audio còn thiếu; tắt ngôn ngữ sẽ hủy tác vụ chưa kết thúc.')
    } catch (error) { toast.error((error as Error).message) }
  }
  return <><Heading title="Ngôn ngữ" detail="Tiếng Việt luôn là ngôn ngữ gốc. Chỉ một ngôn ngữ mặc định.">{can('system.manage_languages') && <button className="primary-button" onClick={() => open()}>+ Thêm ngôn ngữ</button>}</Heading><section className="panel"><div className="table-wrap"><table><thead><tr><th>Mã</th><th>Ngôn ngữ</th><th>Thứ tự</th><th>Trạng thái</th><th /></tr></thead><tbody>{[...data.languages].sort((first, second) => first.display_order - second.display_order).map(language => <tr key={language.code}><td>{language.code}</td><td><strong>{language.native_name}</strong><small className="admin-block">{language.name}{language.is_default ? ' · Mặc định' : ''}{language.code === 'vi' ? ' · Ngôn ngữ gốc' : ''}</small></td><td>{language.display_order}</td><td><Status value={language.is_active ? 'active' : 'inactive'} /></td><td>{can('system.manage_languages') && <button className="text-button" onClick={() => open(language)}>Sửa</button>}</td></tr>)}</tbody></table></div></section>{draft && <CrudDialog title={originalCode ? 'Chỉnh sửa ngôn ngữ' : 'Thêm ngôn ngữ'} onClose={() => { if (!busy) setDraft(null) }}><form className="admin-form" onSubmit={save}><fieldset disabled={busy}><Field label="Mã ngôn ngữ"><input required pattern="[a-z]{2,3}(-[A-Z]{2})?" disabled={Boolean(originalCode)} value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value.trim() })} /></Field><Field label="Tên tiếng Anh"><input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Tên bản địa"><input required value={draft.native_name} onChange={event => setDraft({ ...draft, native_name: event.target.value })} /></Field><Field label="Thứ tự"><input required type="number" min="0" step="1" value={draft.display_order} onChange={event => setDraft({ ...draft, display_order: event.target.valueAsNumber })} /></Field><label className="admin-check"><input type="checkbox" disabled={draft.code === 'vi'} checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} />Đang bật</label>{originalCode && <label className="admin-check"><input type="checkbox" checked={draft.is_default} onChange={event => setDraft({ ...draft, is_default: event.target.checked })} />Làm ngôn ngữ mặc định</label>}<Notice>{localDatabase ? 'Cấu hình được lưu vào MySQL. Chưa bật hàng đợi dịch và tạo audio.' : 'Bật: xếp hàng tạo nội dung/audio thiếu. Tắt: ẩn locale khỏi app, giữ dữ liệu và hủy tác vụ đang chạy.'}</Notice><button className="primary-button">Lưu ngôn ngữ</button></fieldset></form></CrudDialog>}</>
}

