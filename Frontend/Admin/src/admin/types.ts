export const permissionGroups = {
  poi_management: ['poi.create', 'poi.edit', 'poi.delete', 'poi.view', 'poi.assign_qr'],
  content_moderation: ['content.unpublish', 'content.restore', 'content.flag'],
  audio_tasks: ['audio.trigger_regenerate', 'audio.view_tasks', 'audio.cancel_task', 'audio.retry_task'],
  user_management: ['user.create', 'user.edit', 'user.deactivate', 'user.view'],
  role_management: ['role.create', 'role.assign_permission', 'role.view'],
  analytics: ['analytics.view_overview', 'analytics.view_poi_reports', 'analytics.view_user_reports', 'analytics.export'],
  audit: ['audit.view', 'audit.export'],
  system_config: ['system.manage_constants', 'system.manage_languages', 'system.manage_integrations'],
  heatmap_monitoring: ['heatmap.view_live', 'heatmap.view_trend', 'heatmap.configure_zones', 'heatmap.export'],
  offline_packs: ['offline.view', 'offline.manage', 'offline.publish'],
} as const

export type Permission = typeof permissionGroups[keyof typeof permissionGroups][number]
export const permissions = Object.values(permissionGroups).flat() as Permission[]

export const permissionGroupLabels: Record<keyof typeof permissionGroups, string> = {
  poi_management: 'Quản lý điểm tham quan',
  content_moderation: 'Kiểm duyệt nội dung',
  audio_tasks: 'Tác vụ âm thanh',
  user_management: 'Quản lý tài khoản',
  role_management: 'Quản lý vai trò',
  analytics: 'Thống kê và báo cáo',
  audit: 'Nhật ký thao tác',
  system_config: 'Cấu hình hệ thống',
  heatmap_monitoring: 'Theo dõi mật độ',
  offline_packs: 'Gói ngoại tuyến',
}

export const permissionLabels: Record<Permission, string> = {
  'poi.create': 'Tạo điểm tham quan',
  'poi.edit': 'Sửa điểm tham quan',
  'poi.delete': 'Xóa điểm tham quan',
  'poi.view': 'Xem điểm tham quan',
  'poi.assign_qr': 'Gán mã QR',
  'content.unpublish': 'Gỡ nội dung đã công bố',
  'content.restore': 'Khôi phục nội dung',
  'content.flag': 'Đánh dấu nội dung',
  'audio.trigger_regenerate': 'Tạo lại âm thanh thuyết minh',
  'audio.view_tasks': 'Xem tác vụ âm thanh',
  'audio.cancel_task': 'Hủy tác vụ âm thanh',
  'audio.retry_task': 'Chạy lại tác vụ âm thanh',
  'user.create': 'Mời thành viên',
  'user.edit': 'Sửa tài khoản',
  'user.deactivate': 'Vô hiệu hóa tài khoản',
  'user.view': 'Xem tài khoản',
  'role.create': 'Tạo vai trò',
  'role.assign_permission': 'Gán quyền cho vai trò',
  'role.view': 'Xem vai trò',
  'analytics.view_overview': 'Xem thống kê tổng quan',
  'analytics.view_poi_reports': 'Xem báo cáo theo điểm tham quan',
  'analytics.view_user_reports': 'Xem báo cáo người dùng',
  'analytics.export': 'Xuất báo cáo thống kê',
  'audit.view': 'Xem nhật ký thao tác',
  'audit.export': 'Xuất nhật ký thao tác',
  'system.manage_constants': 'Quản lý thông số hệ thống',
  'system.manage_languages': 'Quản lý ngôn ngữ',
  'system.manage_integrations': 'Quản lý tích hợp',
  'heatmap.view_live': 'Xem bản đồ mật độ theo thời gian thực',
  'heatmap.view_trend': 'Xem xu hướng mật độ',
  'heatmap.configure_zones': 'Cấu hình khu vực theo dõi mật độ',
  'heatmap.export': 'Xuất dữ liệu mật độ',
  'offline.view': 'Xem gói ngoại tuyến',
  'offline.manage': 'Quản lý gói ngoại tuyến',
  'offline.publish': 'Phát hành gói ngoại tuyến',
}

export type Language = { code: string; name: string; native_name: string; is_active: boolean; is_default: boolean; display_order: number }
export type Zone = { zone_id: string; name: string; names?: Record<string, string>; description?: string | null; cover_image?: string | null; map_region: { bbox: number[]; min_zoom: number; max_zoom: number }; boundary?: [number, number][] | null; is_active: boolean; poi_count?: number }
export type Content = { name: string; address?: string | null; description?: string | null; introduction?: string | null; text: string; audio_url: string | null; audio_sha256: string | null; audio_source: 'TTS' | 'UPLOADED' | null; is_edited: boolean; updated_at: string }
export type Poi = { poi_id: string; zone_id: string; category: string; location: { lat: number; lng: number }; geofence_radius_m: number; priority?: number; content_version: number; qr_code: string | null; status: 'active' | 'archived'; images: string[]; cover_image?: string | null; content: Record<string, Content>; content_status?: Record<string, string>; readiness?: { ready: boolean; issues: { field: string; message: string }[] }; last_modified_by: string; created_at: string; updated_at: string }
export type Account = { user_id: string; username?: string | null; email: string; full_name: string | null; role_id: string; status: 'pending_activation' | 'active' | 'locked' | 'deactivated'; account_status?: 'pending_activation' | 'active' | 'deactivated'; created_at: string; last_login_at?: string | null; invite_expires_at?: string }
export type Role = { role_id: string; name: string; level: number; permissions: Permission[]; is_system: boolean }
export type AudioTask = { task_id: string; poi_id: string; language_code: string; status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'; progress: number; error: string | null; retry_count: number; created_by: string | null; created_by_name?: string | null; created_by_email?: string | null; created_at: string; started_at: string | null; finished_at: string | null }
export type Audit = { log_id: string; actor_user_id: string; actor_email: string; action: string; target_id: string; before: unknown; after: unknown; timestamp: string }
export type Data = { languages: Language[]; zones: Zone[]; pois: Poi[]; accounts: Account[]; roles: Role[]; tasks: AudioTask[]; audit: Audit[] }
export type Capabilities = { local_database?: boolean; media_uploads?: boolean; audio_tasks?: boolean; tts?: boolean; offline_packs?: boolean; permission_catalog?: Permission[] }
export type Session = { user: Account; permissions: Permission[]; capabilities?: Capabilities }
export type OfflinePart = { language_code: string; status: string; file_url: string | null; sha256: string | null; size_bytes: number | null }
export type OfflineRelease = { outdated?: boolean; id: string; zone_id: string; version: number; status: 'building' | 'ready' | 'published' | 'superseded' | 'failed'; poi_count: number; common_file_url: string | null; common_sha256: string | null; common_size_bytes: number | null; error: string | null; created_at: string; published_at: string | null; languages: OfflinePart[] }
