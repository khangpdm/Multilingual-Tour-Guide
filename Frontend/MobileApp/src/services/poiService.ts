import { assetUrl, httpGet } from './httpClient';
import { readOfflinePackManifests } from './offlinePackService';
import { File } from 'expo-file-system';

export interface POI {
  id: string;
  name: Record<string, string | null> | string;
  description: Record<string, string | null> | string;
  ttsScript: Record<string, string | null>;
  category: string;
  address: Record<string, string | null> | string;
  lat: number;
  lng: number;
  coverImage: string;
  mapLink?: string;
  zoneId?: string;
  qrCode?: string;
  audioUrls?: Record<string, string>;
  geofence_radius_m: number;
}

export interface PublicPOI {
  poi_id: string;
  zone_id: string;
  qr_code?: string | null;
  category: string;
  location: { lat: number; lng: number };
  images: string[];
  cover_image?: string | null;
  content: Record<
    string,
    {
      name?: string;
      text?: string;
      description?: string | null;
      introduction?: string | null;
      address?: string | null;
      audio_url?: string | null;
    }
  >;
  geofence_radius_m: number;
}

export async function fetchOfflinePOIs(zoneId: string, language: string): Promise<POI[]> {
  const pack = await readOfflinePackManifests(zoneId, language);
  if (!pack) return [];
  const localizedById = new Map<string, any>(
    (pack.localized.content || []).map((item: any) => [item.poi_id, item])
  );
  return (pack.common.pois || []).map((item: any) => {
    const content = localizedById.get(item.poi_id) || {};
    const image = item.cover_image || item.images?.[0];
    const imageUri = image?.startsWith('assets/')
      ? new File(pack.commonRoot, image.slice('assets/'.length)).uri
      : image;
    return {
      id: item.poi_id,
      zoneId: item.zone_id,
      name: { [language]: content.name || item.name || item.poi_id },
      description: { [language]: content.text || '' },
      ttsScript: { [language]: content.text || '' },
      category: CATEGORY_ALIASES[item.category] || 'landmark',
      address: { [language]: content.address || null },
      lat: item.location?.lat ?? 0,
      lng: item.location?.lng ?? 0,
      geofence_radius_m: item.geofence_radius_m,
      coverImage: imageUri || 'https://images.unsplash.com/photo-1583417319070-4a69db38a482',
      mapLink: item.map_link,
    };
  });
}

const CATEGORY_ALIASES: Record<string, string> = {
  heritage: 'landmark',
  historical_site: 'landmark',
  landmark: 'landmark',
  museum: 'museum',
  religion: 'religious',
  religious: 'religious',
  architecture: 'architecture',
  park: 'park',
  food: 'food',
};

export function mapPOI(item: PublicPOI): POI {
  const names: Record<string, string> = {};
  const descriptions: Record<string, string> = {};
  const scripts: Record<string, string> = {};
  const addresses: Record<string, string | null> = {};
  const audioUrls: Record<string, string> = {};

  for (const [locale, content] of Object.entries(item.content)) {
    names[locale] = content.name || item.content.en?.name || '';
    descriptions[locale] = content.introduction || content.description || content.text || '';
    scripts[locale] = content.text || '';
    addresses[locale] = content.address || null;
    audioUrls[locale] = assetUrl(content.audio_url);
  }

  return {
    id: item.poi_id,
    zoneId: item.zone_id,
    qrCode: item.qr_code ?? undefined,
    name: names,
    description: descriptions,
    ttsScript: scripts,
    address: addresses,
    audioUrls,
    category: CATEGORY_ALIASES[item.category] || 'landmark',
    lat: item.location.lat,
    lng: item.location.lng,
    geofence_radius_m: item.geofence_radius_m,
    coverImage: assetUrl(item.cover_image || item.images?.[0] || null),
  };
}

let syncedPOIs = new Map<string, POI>();
let syncTimestamp = '';
let syncLanguages = '';
let pendingSync: Promise<POI[]> | undefined;

export function fetchPOIs(): Promise<POI[]> {
  if (pendingSync) return pendingSync;
  const query = syncTimestamp
    ? `?updated_after=${encodeURIComponent(syncTimestamp)}&sync_languages=${encodeURIComponent(syncLanguages)}`
    : '';
  pendingSync = httpGet<{
    updated_pois: PublicPOI[];
    deleted_poi_ids: string[];
    full_sync?: boolean;
    sync_timestamp?: string;
    sync_languages?: string;
  }>(`/poi/load-all${query}`).then((data) => {
    const next = query && data.full_sync === false ? new Map(syncedPOIs) : new Map<string, POI>();
    for (const id of data.deleted_poi_ids ?? []) next.delete(id);
    for (const item of data.updated_pois) next.set(item.poi_id, mapPOI(item));
    syncedPOIs = next;
    const timestamp = Date.parse(data.sync_timestamp ?? '');
    // Overlap by one second for records committed during a request.
    syncTimestamp = Number.isFinite(timestamp) ? new Date(timestamp - 1000).toISOString() : '';
    syncLanguages = data.sync_languages ?? '';
    return [...next.values()].sort((first, second) => first.id.localeCompare(second.id));
  }).finally(() => { pendingSync = undefined; });
  return pendingSync;
}

export async function fetchPOIDetail(poiId: string): Promise<POI> {
  const data = await httpGet<{ poi: PublicPOI }>(`/poi/${encodeURIComponent(poiId)}`);
  return mapPOI(data.poi);
}

export function qrToken(value: string): string | null {
  const raw = value.trim();
  if (/^[A-Za-z0-9_-]{16,128}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const match = url.pathname.match(/^\/q\/([A-Za-z0-9_-]{16,128})\/?$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export async function fetchPOIByQR(token: string, language: string): Promise<POI> {
  const data = await httpGet<{ poi: PublicPOI }>(
    `/poi/by-qr/${encodeURIComponent(token)}?lang=${encodeURIComponent(language)}`
  );
  return mapPOI(data.poi);
}
