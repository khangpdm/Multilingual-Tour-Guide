import { toast } from 'sonner'
import { useEffect, useState, type FormEvent } from 'react'
import { assetUrl } from '../../admin/api'
import { emptyContent, stamp, useAdmin } from '../../admin/store'
import type { Content, Poi } from '../../admin/types'
import { Field, Notice, Status } from '../../shared/ui'

export function ContentFields({ value, onChange }: { value: Content; onChange: (value: Content) => void }) {
  return <>
    <Field label="Tên địa điểm"><input required maxLength={200} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></Field>
    <Field label="Địa chỉ"><input maxLength={500} value={value.address || ''} onChange={event => onChange({ ...value, address: event.target.value })} /></Field>
    <Field label="Mô tả ngắn trên thẻ địa điểm"><textarea rows={3} maxLength={5000} value={value.description || ''} onChange={event => onChange({ ...value, description: event.target.value })} /></Field>
    <Field label="Bài giới thiệu trên trang chi tiết"><textarea rows={7} maxLength={20000} value={value.introduction || ''} onChange={event => onChange({ ...value, introduction: event.target.value })} /></Field>
    <Field label="Kịch bản thuyết minh"><textarea required rows={7} maxLength={5000} value={value.text} onChange={event => onChange({ ...value, text: event.target.value })} /></Field>
  </>
}

export function PoiContentEditor({ poi }: { poi: Poi }) {
  const { data, can, mutate, busy, mode, capabilities } = useAdmin()
  const [locale, setLocale] = useState('vi')
  const [draft, setDraft] = useState<Content>(poi.content.vi || emptyContent())
  const [dirty, setDirty] = useState(false)

  const [locales, setLocales] = useState<string[]>(['vi'])
  const [replace, setReplace] = useState(false)
  const current = poi.content[locale]
  useEffect(() => { if (!dirty) setDraft(current || emptyContent()) }, [current, dirty])
  const enabled = data.languages.some(language => language.code === locale && language.is_active)
  const editable = can('poi.edit') && poi.status !== 'archived' && enabled
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      const body = { name: draft.name.trim(), address: draft.address?.trim() || null, description: draft.description?.trim() || null, introduction: draft.introduction?.trim() || null, text: draft.text.trim() }
      if (!body.name || !body.text) throw new Error('Tên và kịch bản không được để trống.')
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/content/${locale}`, method: 'PUT', body, action: 'poi.content_edit', target: poi.poi_id, demo: state => ({ ...state, pois: state.pois.map(item => item.poi_id === poi.poi_id ? { ...item, content: { ...item.content, [locale]: { ...draft, ...body, updated_at: stamp() } } } : item) }) })
      setDirty(false)
      toast.success('Đã lưu nội dung. Nếu kịch bản thay đổi, audio TTS cũ được bỏ để tạo lại; audio tải lên được giữ nguyên và cần tự kiểm tra.')
    } catch (error) { toast.error((error as Error).message) }
  }
  async function upload(file?: File) {
    if (!file) return
    try {
      if (mode !== 'live') throw new Error('Upload cần API thật.')
      if (dirty || !current) throw new Error('Lưu nội dung trước khi tải audio.')
      if (file.size > 15 * 1024 * 1024) throw new Error('MP3 tối đa 15 MB.')
      const body = new FormData(); body.set('file', file)
      await mutate({ permission: 'poi.edit', path: `/admin/pois/${poi.poi_id}/content/${locale}/audio`, body, action: 'poi.audio_upload', target: poi.poi_id, demo: state => state })
      toast.success('Đã lưu audio và mã SHA-256. Có thể nghe thử bên dưới.')
    } catch (error) { toast.error((error as Error).message) }
  }
  async function regenerate() {
    try {
      if (dirty) throw new Error('Lưu nội dung trước khi tạo audio.')
      if (replace && !window.confirm('Cho phép thay thế MP3 đã tải lên bằng audio TTS?')) return
      const result = await mutate<{ tasks_created: string[]; skipped: { locale: string; reason: string }[] }>({ permission: 'audio.trigger_regenerate', path: `/admin/pois/${poi.poi_id}/audio/regenerate`, body: { locales, replace_uploaded_audio: replace }, action: 'audio.regenerate', target: poi.poi_id, demo: state => state })
      toast.success(`Đã xếp hàng ${result?.tasks_created.length || 0} tác vụ. ${result?.skipped.map(item => `${item.locale}: ${item.reason}`).join('; ') || ''}`)
    } catch (error) { toast.error((error as Error).message) }
  }
  return <div className="admin-form">
    <Field label="Ngôn ngữ biên tập"><select value={locale} onChange={event => { if (dirty && !window.confirm('Bỏ nội dung chưa lưu để đổi ngôn ngữ?')) return; setDirty(false); setLocale(event.target.value); }}>{data.languages.map(language => <option key={language.code} value={language.code}>{language.native_name}{language.is_active ? '' : ' (đã tắt)'}</option>)}</select></Field>
    
    <form onSubmit={save}><fieldset disabled={!editable || busy}><ContentFields value={draft} onChange={value => { setDraft(value); setDirty(true) }} />{editable && <button className="primary-button">Lưu nội dung {locale.toUpperCase()}{dirty ? ' *' : ''}</button>}</fieldset></form>
    <section className="regenerate-panel"><h3>Audio của {locale.toUpperCase()}</h3>
      {current?.audio_url ? <><p>Nguồn: {current.audio_source === 'UPLOADED' ? 'MP3 tải lên' : 'TTS'}</p><audio key={current.audio_url} controls preload="metadata" src={assetUrl(current.audio_url)} /><small className="checksum">SHA-256: {current.audio_sha256}</small></> : <Notice>Chưa có audio cho ngôn ngữ này.</Notice>}
      {editable && <Field label="Tải hoặc thay MP3 tối đa 15 MB"><input type="file" accept="audio/mpeg,.mp3" disabled={busy || dirty || !current || mode !== 'live'} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></Field>}
    </section>
    {can('audio.trigger_regenerate') && poi.status !== 'archived' && <section className="regenerate-panel"><h3>Tạo lại bằng TTS</h3>
      {!capabilities.tts && <Notice>Chưa cấu hình dịch vụ TTS. Bạn vẫn có thể tải MP3; cấu hình TTS_ENDPOINT ở backend để bật tạo audio. Bản dịch được biên tập thủ công.</Notice>}
      <div className="admin-actions">{data.languages.filter(language => language.is_active).map(language => <label className="admin-check" key={language.code}><input type="checkbox" checked={locales.includes(language.code)} onChange={event => setLocales(event.target.checked ? [...locales, language.code] : locales.filter(value => value !== language.code))} />{language.native_name}</label>)}</div>
      <label className="admin-check"><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} />Cho phép thay audio đã tải lên</label>
      <button className="secondary-button" disabled={busy || dirty || !locales.length || !capabilities.tts || mode !== 'live'} onClick={() => void regenerate()}>Xếp hàng tạo audio</button>
      {data.tasks.filter(task => task.poi_id === poi.poi_id).slice(0, 8).map(task => <p key={task.task_id}>{task.language_code} · <Status value={task.status} /> · {task.progress}% {task.error && <small className="admin-error">{task.error}</small>}</p>)}
    </section>}
  </div>
}
