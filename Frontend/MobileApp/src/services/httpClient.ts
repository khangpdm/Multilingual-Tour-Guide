import { Platform } from 'react-native';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000')
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function assetUrl(value?: string | null): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith('/') || value.startsWith('//')) return '';
  return `${API_BASE_URL}${value}`;
}

async function request<T>(endpoint: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(response.status, data.error?.message || `HTTP ${response.status}`);
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function httpGet<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint);
}

export function httpPost<T>(endpoint: string, body: unknown): Promise<T> {
  return request<T>(endpoint, body);
}
