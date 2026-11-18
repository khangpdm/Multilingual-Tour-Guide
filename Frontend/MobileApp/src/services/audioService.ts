import { assetUrl, httpGet, httpPost, API_BASE_URL } from './httpClient';

export interface SynthesizeResponse {
  status: 'ready' | 'queued';
  audio_url?: string;
  audio_sha256?: string;
  audio_fallback_locale?: string | null;
  task_id?: string;
  poll_after_ms?: number;
}

export function requestSynthesizeAudio(
  poi_id: string,
  target_locale: string
): Promise<SynthesizeResponse> {
  return httpPost<SynthesizeResponse>('/audio/synthesize', { poi_id, target_locale });
}

export function getAudioTaskStatus(taskId: string): Promise<{ state?: string; status?: string }> {
  return httpGet<{ state?: string; status?: string }>(`/audio/tasks/${encodeURIComponent(taskId)}`);
}

export function getAudioFileUrl(poiId: string, locale: string): string {
  return `${API_BASE_URL}/audio/${encodeURIComponent(poiId)}/${encodeURIComponent(locale)}.mp3`;
}

export function resolvedAudioUrl(value?: string): string {
  return assetUrl(value);
}
