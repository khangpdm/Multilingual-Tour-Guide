import { httpGet, httpPost, API_BASE_URL } from './httpClient';

export interface SynthesizeResponse {
  status: 'ready' | 'queued';
  audio_url?: string;
  audio_sha256?: string;
  task_id?: string;
  poll_after_ms?: number;
}

export async function requestSynthesizeAudio(poi_id: string, target_locale: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/audio/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'mobile-device-uuid-or-default',
    },
    body: JSON.stringify({
      poi_id: poi_id,
      target_locale: target_locale,
    }),
  });

  if (!res.ok) {
    const errorDetail = await res.text();
    throw new Error(`Synthesize failed [${res.status}]: ${errorDetail}`);
  }

  return await res.json();
}

export async function getAudioTaskStatus(taskId: string): Promise<any> {
  return await httpGet<any>(`/audio/tasks/${taskId}`);
}

export function getAudioFileUrl(poiId: string, locale: string): string {
  return `${API_BASE_URL}/audio/${poiId}/${locale}.mp3`;
}
