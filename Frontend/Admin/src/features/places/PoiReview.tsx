import { useState } from 'react'
import { assetUrl } from '../../admin/api'
import { useAdmin } from '../../admin/store'
import type { Poi } from '../../admin/types'
import { Field, Notice } from '../../shared/ui'

export const categories: Record<string, string> = { heritage: 'Di tích', museum: 'Bảo tàng', religion: 'Tôn giáo', architecture: 'Kiến trúc', park: 'Công viên', food: 'Ẩm thực' }
export function publicationIssues(poi: Poi, locales = ['vi']) {
  const issues: string[] = []
  if (!categories[poi.category]) issues.push('Chọn danh mục chuẩn.')
  if (!poi.images.length) issues.push('Thêm ít nhất một ảnh.')
  if (!poi.cover_image || !poi.images.includes(poi.cover_image)) issues.push('Chọn ảnh đại diện.')
  for (const locale of locales) {
    const content = poi.content[locale]
    for (const [field, label] of [['name', 'tên'], ['description', 'mô tả ngắn'], ['introduction', 'bài giới thiệu'], ['text', 'kịch bản'], ['audio_url', 'audio'], ['audio_sha256', 'mã kiểm tra audio']] as const) {
      if (!content?.[field]?.trim()) issues.push(`${locale}: thiếu ${label}.`)
    }
  }
  return issues
}

export function PoiReview({ poi }: { poi: Poi }) {
  const { data } = useAdmin()
  const [locale, setLocale] = useState('vi')
  const content = poi.content[locale]
  const issues = publicationIssues(poi)
  if (!data.zones.some(zone => zone.zone_id === poi.zone_id && zone.is_active)) issues.push('Khu vực đang tắt.')
  return <div className="poi-review-grid">
    <section><h3>Kiểm tra trước khi công khai</h3><Notice>{issues.length ? `Còn ${issues.length} mục cần hoàn thiện.` : 'Đủ dữ liệu tiếng Việt, hình ảnh và audio để công khai.'}</Notice>
      <ul className="readiness-list">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
      <p>Công khai yêu cầu nội dung và audio tiếng Việt. Gói offline kiểm tra thêm tất cả ngôn ngữ được chọn. QR không bắt buộc để công khai.</p>
      <h3>Mức hoàn thiện theo ngôn ngữ</h3>{data.languages.filter(language => language.is_active).map(language => { const missing = publicationIssues(poi, [language.code]); return <details key={language.code}><summary>{language.native_name}: {missing.length ? `${missing.length} mục còn thiếu` : 'Sẵn sàng'}</summary><ul>{missing.map(issue => <li key={issue}>{issue}</li>)}</ul></details> })}
    </section>
    <section><Field label="Ngôn ngữ xem trước"><select value={locale} onChange={event => setLocale(event.target.value)}>{data.languages.map(language => <option key={language.code} value={language.code}>{language.native_name}</option>)}</select></Field>
      <article className="poi-mobile-preview">{poi.cover_image ? <img className="poi-preview-cover" src={assetUrl(poi.cover_image)} alt={content?.name || 'Ảnh đại diện'} /> : <div className="poi-preview-placeholder">Chưa có ảnh đại diện</div>}
        <div className="poi-preview-body"><small>{categories[poi.category] || poi.category}</small><h2>{content?.name || 'Chưa có tên'}</h2><p>{content?.address || 'Chưa có địa chỉ'}</p><p className="poi-preview-summary">{content?.description || 'Chưa có mô tả ngắn'}</p><h3>Giới thiệu</h3><p className="preserve-lines">{content?.introduction || 'Chưa có bài giới thiệu'}</p><h3>Thuyết minh</h3>{content?.audio_url ? <audio controls src={assetUrl(content.audio_url)} preload="none" /> : <p>Chưa có audio</p>}<details><summary>Xem kịch bản thuyết minh</summary><p className="preserve-lines">{content?.text || 'Chưa có kịch bản'}</p></details></div>
      </article><small>Bản xem trước nội dung đã lưu, không phải ứng dụng Enduser đang chạy.</small>
    </section>
  </div>
}
