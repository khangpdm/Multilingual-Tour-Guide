const environment = (import.meta as ImportMeta & { env: Record<string, string> }).env

export const apiBase = (environment.VITE_API_BASE_URL || '').replace(/\/$/, '')

export function assetUrl(path: string | null) {
  return !path ? '' : path.startsWith('/') && !path.startsWith('//') ? `${apiBase}${path}` : /^https:\/\//i.test(path) ? path : ''
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

let refreshPromise: Promise<Response> | null = null

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try { return await fetch(url, init) }
  catch { throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.') }
}

export function responseError(status: number): string {
  const messages: Record<number, string> = {
    400: 'Yêu cầu không hợp lệ.', 401: 'Vui lòng đăng nhập để tiếp tục.',
    403: 'Bạn không có quyền thực hiện thao tác này.', 404: 'Không tìm thấy dữ liệu yêu cầu.',
    409: 'Dữ liệu đã thay đổi hoặc thao tác bị trùng. Vui lòng tải lại.',
    413: 'Dữ liệu gửi lên vượt quá dung lượng cho phép.', 422: 'Dữ liệu nhập chưa hợp lệ.',
    429: 'Bạn thao tác quá nhanh. Vui lòng chờ và thử lại.',
  }
  return messages[status] || 'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại sau.'
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await apiFetch(`${apiBase}${path}`, { ...init, headers, credentials: 'include' })
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    refreshPromise ??= apiFetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' }).finally(() => { refreshPromise = null })
    if ((await refreshPromise).ok) return api<T>(path, init, false)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (!path.startsWith('/auth/') && (response.status === 401 || ['ACCOUNT_DEACTIVATED', 'ACCOUNT_PENDING'].includes(body?.error?.code))) window.dispatchEvent(new Event('admin-session-expired'))
    const details = body?.error?.details?.map((item: { label?: string; reason: string }) => `${item.label || 'Dữ liệu'}: ${item.reason}`).join('; ')
    throw new ApiError(`${body?.error?.message || responseError(response.status)}${details ? ` — ${details}` : ''}${response.status === 429 ? ` (thử lại sau ${response.headers.get('Retry-After') || 'ít'} giây)` : ''}`, response.status)
  }
  if (response.status === 204) return undefined as T
  if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Chưa kết nối được máy chủ quản trị. Kiểm tra cấu hình máy chủ.')
  try { return await response.json() as T }
  catch { throw new Error('Phản hồi từ máy chủ không hợp lệ. Vui lòng tải lại trang.') }
}

export async function listAll<T>(path: string): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const result = await api<{ items: T[]; total: number }>(`${path}?page=${page}&page_size=100`)
    items.push(...result.items)
    if (items.length >= result.total || !result.items.length) return items
  }
}
