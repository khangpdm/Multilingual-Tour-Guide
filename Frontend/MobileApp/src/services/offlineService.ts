import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoDigestAlgorithm, digest, randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { getNetworkStateAsync, NetworkStateType } from 'expo-network';
import { Platform } from 'react-native';
import { API_BASE_URL, assetUrl, httpGet } from './httpClient';
import { mapPOI, type POI, type PublicPOI } from './poiService';

export interface OfflineRelease {
  id: string;
  zone_id: string;
  zone_name: string;
  version: number;
  poi_count: number;
  common: { size_bytes: number; sha256: string; file_url: string };
  languages: { language_code: string; size_bytes: number; sha256: string; file_url: string }[];
}

interface Manifest {
  schema_version: number;
  release_id: string;
  version: number;
  source_hash: string;
  language?: string;
  pois?: PublicPOI[];
  content?: ({ poi_id: string } & PublicPOI['content'][string])[];
  resources: { path: string; sha256: string; url: string }[];
}

export interface OfflineInstall {
  key: string;
  releaseId: string;
  zoneId: string;
  zoneName: string;
  version: number;
  language: string;
  bytes: number;
  folder: string;
  pois: POI[];
}

const storageKey = `tour-offline-v1:${API_BASE_URL}`;
let changing = false;

export async function fetchOfflineReleases(): Promise<OfflineRelease[]> {
  return (await httpGet<{ items: OfflineRelease[] }>('/offline-packs')).items;
}

function safeFolder(uri: string) {
  const root = new Directory(Paths.document, 'tour-offline').uri.replace(/\/+$/, '') + '/';
  return uri.startsWith(root) && /^[a-f0-9-]+\/?$/.test(uri.slice(root.length));
}

export async function listOfflineInstalls(): Promise<OfflineInstall[]> {
  if (Platform.OS === 'web') return [];
  const stored = await AsyncStorage.getItem(storageKey);
  if (!stored) return [];
  const records: OfflineInstall[] = JSON.parse(stored);
  if (!Array.isArray(records)) throw new Error('Invalid offline index');
  return records.filter(
    (item) =>
      safeFolder(item.folder) &&
      new Directory(item.folder).exists &&
      item.pois.every((poi) =>
        Object.values(poi.audioUrls || {})
          .filter(Boolean)
          .every((uri) => new File(uri).exists)
      )
  );
}

export async function loadOfflinePOIs(): Promise<POI[]> {
  const installs = (await listOfflineInstalls()).sort(
    (left, right) => right.version - left.version
  );
  const result = new Map<string, { releaseId: string; poi: POI }>();
  for (const install of installs) {
    for (const poi of install.pois) {
      const previous = result.get(poi.id);
      if (!previous) result.set(poi.id, { releaseId: install.releaseId, poi });
      else if (previous.releaseId === install.releaseId)
        result.set(poi.id, {
          releaseId: install.releaseId,
          poi: {
            ...previous.poi,
            audioUrls: { ...previous.poi.audioUrls, ...poi.audioUrls },
            name: {
              ...(previous.poi.name as Record<string, string>),
              ...(poi.name as Record<string, string>),
            },
            description: {
              ...(previous.poi.description as Record<string, string>),
              ...(poi.description as Record<string, string>),
            },
            ttsScript: { ...previous.poi.ttsScript, ...poi.ttsScript },
          },
        });
    }
  }
  return [...result.values()].map((item) => item.poi);
}

export async function installOffline(
  release: OfflineRelease,
  language: string,
  wifiOnly: boolean,
  progress: (percent: number) => void
): Promise<void> {
  if (Platform.OS === 'web') throw new Error('OFFLINE_NATIVE_ONLY');
  if (changing) throw new Error('OFFLINE_BUSY');
  changing = true;
  let folder: Directory | undefined;
  let committed = false;
  try {
    if (wifiOnly && (await getNetworkStateAsync()).type !== NetworkStateType.WIFI)
      throw new Error('OFFLINE_WIFI_REQUIRED');
    if (
      !/^[a-f0-9-]{36}$/.test(release.id) ||
      !release.languages.some((part) => part.language_code === language)
    )
      throw new Error('INVALID_RELEASE');
    const parts = [...new Set(['common', 'en', language])];
    const manifests: Manifest[] = [];
    for (const part of parts) {
      const manifest = await httpGet<Manifest>(`/offline-packs/${release.id}/manifest/${part}`);
      if (
        manifest.schema_version !== 1 ||
        manifest.release_id !== release.id ||
        manifest.version !== release.version ||
        (part !== 'common' && manifest.language !== part) ||
        (manifests.length > 0 && manifest.source_hash !== manifests[0].source_hash)
      )
        throw new Error('INVALID_MANIFEST');
      manifests.push(manifest);
    }
    if (!manifests[0].pois?.length) throw new Error('EMPTY_PACK');
    folder = new Directory(Paths.document, 'tour-offline', randomUUID());
    folder.create({ intermediates: true });
    const files = new Map<string, string>();
    const total = manifests.reduce((count, manifest) => count + manifest.resources.length, 0);
    let completed = 0;
    let bytes = 0;
    for (let index = 0; index < manifests.length; index += 1) {
      const part = parts[index];
      const directory = new Directory(folder, part);
      directory.create();
      for (const resource of manifests[index].resources) {
        if (
          !/^assets\/[a-f0-9]{32}\.(jpg|png|webp|mp3)$/.test(resource.path) ||
          !/^[a-f0-9]{64}$/.test(resource.sha256)
        )
          throw new Error('INVALID_RESOURCE');
        const name = resource.path.slice('assets/'.length);
        if (resource.url !== `/offline-packs/${release.id}/assets/${part}/${name}`)
          throw new Error('INVALID_RESOURCE_URL');
        const output = await File.downloadFileAsync(
          assetUrl(resource.url),
          new File(directory, name)
        );
        if (!output.exists || output.size > 15 * 1024 * 1024)
          throw new Error('INVALID_RESOURCE_SIZE');
        const checksum = Array.from(
          new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, await output.bytes())),
          (value) => value.toString(16).padStart(2, '0')
        ).join('');
        if (checksum !== resource.sha256) throw new Error('CHECKSUM_MISMATCH');
        bytes += output.size;
        files.set(`${part}/${resource.path}`, output.uri);
        progress(Math.round((++completed / Math.max(total, 1)) * 100));
      }
    }
    const pois = manifests[0].pois.map((source) => {
      const content: PublicPOI['content'] = {};
      for (let index = 1; index < manifests.length; index += 1) {
        const entry = manifests[index].content?.find((item) => item.poi_id === source.poi_id);
        if (!entry?.audio_url || !files.has(`${parts[index]}/${entry.audio_url}`))
          throw new Error('MISSING_AUDIO');
        content[parts[index]] = entry;
      }
      const poi = mapPOI({ ...source, content });
      const image = source.cover_image || source.images[0];
      poi.coverImage = files.get(`common/${image}`) || '';
      if (!poi.coverImage) throw new Error('MISSING_IMAGE');
      poi.audioUrls = Object.fromEntries(
        Object.entries(content).map(([locale, entry]) => [
          locale,
          files.get(`${locale}/${entry.audio_url}`)!,
        ])
      );
      return poi;
    });
    const current = await listOfflineInstalls();
    const obsolete = current.filter(
      (item) => item.zoneId === release.zone_id && item.language === language
    );
    const install: OfflineInstall = {
      key: `${release.id}:${language}`,
      releaseId: release.id,
      zoneId: release.zone_id,
      zoneName: release.zone_name,
      version: release.version,
      language,
      bytes,
      folder: folder.uri,
      pois,
    };
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify([...current.filter((item) => !obsolete.includes(item)), install])
    );
    committed = true;
    for (const item of obsolete) {
      try {
        new Directory(item.folder).delete();
      } catch {}
    }
  } finally {
    try {
      if (!committed && folder?.exists) folder.delete();
    } finally {
      changing = false;
    }
  }
}

export async function removeOffline(key: string): Promise<void> {
  if (changing) throw new Error('OFFLINE_BUSY');
  changing = true;
  try {
    const installs = await listOfflineInstalls();
    const target = installs.find((item) => item.key === key);
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify(installs.filter((item) => item.key !== key))
    );
    if (target && safeFolder(target.folder)) new Directory(target.folder).delete();
  } finally {
    changing = false;
  }
}
