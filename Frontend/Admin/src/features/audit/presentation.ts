export const auditActions: Record<string, string> = {
  'poi.create': 'Tạo địa điểm', 'poi.update': 'Cập nhật thông tin địa điểm',
  'poi.content_edit': 'Chỉnh sửa nội dung thuyết minh', 'poi.archive': 'Lưu trữ địa điểm',
  'poi.restore': 'Khôi phục địa điểm', 'poi.version_restore': 'Khôi phục phiên bản nội dung',
  'poi.audio_upload': 'Tải lên MP3', 'poi.image_add': 'Thêm hình ảnh',
  'poi.image_remove': 'Gỡ hình ảnh', 'poi.images_order': 'Sắp xếp ảnh hoặc đổi ảnh đại diện',
  'poi.assign_qr': 'Cấp mã QR', 'poi.delete': 'Lưu trữ địa điểm', 'poi.edit': 'Chỉnh sửa địa điểm',
  'audio.completed': 'Hoàn tất tạo audio', 'audio.regenerate': 'Yêu cầu tạo lại audio',
  'audio.cancel': 'Hủy tác vụ audio', 'audio.retry': 'Thử lại tác vụ audio',
  'zone.create': 'Tạo khu vực', 'zone.update': 'Cập nhật khu vực',
  'language.create': 'Thêm ngôn ngữ', 'language.update': 'Cập nhật ngôn ngữ',
  'system.geofence_update': 'Thay đổi bán kính nhận diện chung',
  'offline.build': 'Tạo gói offline', 'offline.publish': 'Phát hành gói offline',
  'offline.withdraw': 'Thu hồi gói offline', 'user.invite': 'Mời tài khoản quản trị', 'user.reissue_invitation': 'Cấp lại link kích hoạt', 'user.lock': 'Khóa tài khoản', 'user.unlock': 'Mở khóa tài khoản', 'user.request_password_reset': 'Yêu cầu đặt lại mật khẩu',
  'user.update': 'Cập nhật tài khoản', 'user.deactivate': 'Vô hiệu hóa tài khoản',
  'user.activate': 'Kích hoạt tài khoản', 'role.create': 'Tạo vai trò',
  'role.assign_permission': 'Thay đổi quyền của vai trò', 'login_success': 'Đăng nhập thành công',
  'account_locked': 'Khóa tài khoản do đăng nhập sai', 'password_reset': 'Đặt lại mật khẩu',
}

const fieldNames: Record<string, string> = {
  content: 'Nội dung', name: 'Tên', address: 'Địa chỉ', description: 'Mô tả ngắn',
  introduction: 'Bài giới thiệu', text: 'Kịch bản thuyết minh', category: 'Danh mục',
  zone_id: 'Khu vực', location: 'Vị trí', lat: 'Vĩ độ', lng: 'Kinh độ', priority: 'Độ ưu tiên',
  geofence_radius_m: 'Bán kính nhận diện (m)', radius_m: 'Bán kính nhận diện (m)',
  content_version: 'Phiên bản', status: 'Trạng thái', is_archived: 'Đã lưu trữ',
  images: 'Hình ảnh', cover_image: 'Ảnh đại diện', audio_url: 'Audio', audio_source: 'Nguồn audio',
  is_edited: 'Đã biên tập', is_active: 'Đang hoạt động', is_default: 'Ngôn ngữ mặc định',
  code: 'Ngôn ngữ', language_code: 'Ngôn ngữ', native_name: 'Tên bản địa', display_order: 'Thứ tự hiển thị',
  full_name: 'Họ và tên', email: 'Email', username: 'Tên đăng nhập', role_id: 'Vai trò',
  permissions: 'Quyền truy cập', level: 'Cấp quyền', is_system: 'Vai trò hệ thống',
  map_region: 'Vùng bản đồ', bbox: 'Giới hạn bản đồ', boundary: 'Ranh giới',
  min_zoom: 'Mức thu phóng tối thiểu', max_zoom: 'Mức thu phóng tối đa',
  tasks: 'Tác vụ', state: 'Trạng thái', progress: 'Tiến độ (%)', error: 'Thông báo lỗi',
  retry_count: 'Số lần thử lại', version: 'Phiên bản', locales: 'Ngôn ngữ',
  locked_until: 'Khóa đến', mfa_bypassed_local: 'Đăng nhập local không dùng OTP',
  unpublish_reason: 'Lý do gỡ công khai', value: 'Giá trị',
}

const hiddenFields = new Set(['_id', 'id', 'poi_id', 'task_id', 'last_modified_by', 'created_at', 'updated_at', 'audio_sha256', 'qr_code'])

function readableKey(key: string) {
  return fieldNames[key] || key.replace(/[_.]/g, ' ')
}

export function auditFieldLabel(path: string, languages: { code: string; native_name: string }[]) {
  return path.split('.').map(part => languages.find(language => language.code === part)?.native_name || (/^\d+$/.test(part) ? `Mục ${Number(part) + 1}` : readableKey(part))).join(' · ')
}

function flatten(value: unknown, prefix = '', result = new Map<string, unknown>()) {
  if (value === null || value === undefined) return result
  if (Array.isArray(value) && value.some(item => item !== null && typeof item === 'object')) {
    value.forEach((item, index) => flatten(item, prefix ? `${prefix}.${index}` : String(index), result))
  } else if (typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/-/g, '_')
      if (hiddenFields.has(key) || /password|secret|token|api_?key|credential|authorization|cookie/.test(normalized)) continue
      flatten(item, prefix ? `${prefix}.${key}` : key, result)
    }
  } else {
    result.set(prefix || 'value', value)
  }
  return result
}

export function auditChanges(before: unknown, after: unknown) {
  const previous = flatten(before)
  const current = flatten(after)
  return [...new Set([...previous.keys(), ...current.keys()])]
    .filter(path => JSON.stringify(previous.get(path)) !== JSON.stringify(current.get(path)))
    .map(path => ({ path, before: previous.get(path), after: current.get(path) }))
}
