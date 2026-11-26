import { sha256 } from 'js-sha256';
import { unzipSync, strFromU8 } from 'fflate';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { API_BASE_URL, httpGet } from './httpClient';

export interface OfflineZone {
  zone_id: string;
  name: string;
  map_region?: {
    bbox: number[];
    min_zoom: number;
    max_zoom: number;
  };
}

export interface OfflinePackArtifact {
  url: string;
  sha256: string;
  size_bytes: number;
}

export interface OfflinePackManifest {
  zone_id: string;
  release_id: string;
  version: number;
  common_pack: OfflinePackArtifact;
  language_shards: (OfflinePackArtifact & { language_code: string })[];
}

export interface OfflinePackMetadata {
  zone_id: string;
  release_id: string;
  version: number;
  status: 'partial' | 'ready';
  common: OfflinePackArtifact & { local_path: string; archive_path: string; downloaded_at: string };
  languages: Record<
    string,
    OfflinePackArtifact & { local_path: string; archive_path: string; downloaded_at: string }
  >;
}

interface CommonManifest {
  schema_version: 1;
  release_id: string;
  version: number;
  zone: { zone_id: string };
  pois: { poi_id: string }[];
}

interface LanguageManifest {
  schema_version: 1;
  release_id: string;
  version: number;
  zone: { zone_id: string };
  language: string;
  content: { poi_id: string }[];
}

type ZipManifest = CommonManifest | LanguageManifest;

export type OfflineDownloadProgress = {
  downloaded: number;
  total: number;
  progress: number;
};

const METADATA_KEY = '@vietguide/offline-packs';
const offlineRoot = new Directory(Paths.document, 'offline-packs');
const MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5_000;
const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;

export async function fetchOfflineZones(): Promise<OfflineZone[]> {
  const response = await httpGet<{ zones?: OfflineZone[] }>('/offline-packs/zones');
  return response.zones ?? [];
}

export async function fetchOfflineManifest(
  zoneId: string,
  languages: string[]
): Promise<OfflinePackManifest> {
  const query = encodeURIComponent(languages.join(','));
  return httpGet<OfflinePackManifest>(
    `/offline-packs/${encodeURIComponent(zoneId)}/manifest?langs=${query}`
  );
}

async function loadMetadata(): Promise<Record<string, OfflinePackMetadata>> {
  const raw = await AsyncStorage.getItem(METADATA_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, OfflinePackMetadata>;
  } catch {
    throw new Error('Dữ liệu Offline Pack trên thiết bị bị hỏng.');
  }
}

async function saveMetadata(metadata: Record<string, OfflinePackMetadata>) {
  await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
}

export async function getOfflinePackMetadata(): Promise<Record<string, OfflinePackMetadata>> {
  return loadMetadata();
}

export async function readOfflinePackManifests(zoneId: string, language: string) {
  const metadata = (await loadMetadata())[zoneId];
  if (!metadata || !metadata.languages[language]) return null;
  const common = await new File(new Directory(metadata.common.local_path), 'manifest.json').json();
  const commonRoot = new Directory(metadata.common.local_path);
  const localizedRoot = new Directory(metadata.languages[language].local_path);
  const localized = await new File(localizedRoot, 'manifest.json').json();
  return { common, localized, commonRoot, localizedRoot };
}

export async function findOfflineAudioUri(poiId: string, language: string): Promise<string | null> {
  const metadata = await loadMetadata();

  for (const pack of Object.values(metadata)) {
    const shard = pack.languages?.[language];

    if (!shard?.local_path) continue;

    try {
      const localizedRoot = new Directory(shard.local_path);
      if (!localizedRoot.exists) continue;

      const manifest = await new File(localizedRoot, 'manifest.json').json();

      const content = Array.isArray(manifest.content) ? manifest.content : [];

      const poiContent = content.find((item: any) => item.poi_id === poiId);

      const audioPath = poiContent?.audio_url;

      if (
        typeof audioPath !== 'string' ||
        !audioPath.startsWith('assets/') ||
        audioPath.split('/').some((part: string) => part === '..' || part === '')
      ) {
        continue;
      }

      const parts = audioPath.split('/');
      const audioFile = new File(localizedRoot, ...parts);

      if (audioFile.exists && (audioFile.size ?? 0) > 0) {
        return audioFile.uri;
      }
    } catch (error) {
      console.warn(`[OfflineAudio] Không đọc được shard ${language}:`, error);
    }
  }

  return null;
}

function assertSafeZipPath(name: string) {
  if (
    !name ||
    name.startsWith('/') ||
    name.includes('\\') ||
    /^[A-Za-z]:/.test(name) ||
    name.split('/').some((part) => part === '..')
  ) {
    throw new Error('ZIP chứa đường dẫn không an toàn.');
  }
}

function resolveDownloadUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

function ensureDirectory(directory: Directory) {
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
}

async function verifyFile(file: File, artifact: OfflinePackArtifact) {
  if (!file.exists) throw new Error('File tải xuống không tồn tại.');
  if (artifact.size_bytes > MAX_ARTIFACT_BYTES) {
    throw new Error('Offline Pack vượt quá giới hạn kích thước trên thiết bị.');
  }
  if (file.size !== artifact.size_bytes) {
    throw new Error('Dung lượng file tải xuống không khớp manifest.');
  }
  const checksum = sha256(await file.bytes());
  if (checksum !== artifact.sha256) {
    throw new Error('SHA-256 của file tải xuống không khớp manifest.');
  }
}

function validateManifest(
  value: unknown,
  kind: 'common' | 'language',
  expected: { zoneId: string; releaseId: string; version: number; language?: string },
  commonPoiIds?: Set<string>
): ZipManifest {
  if (!value || typeof value !== 'object') throw new Error('manifest.json không hợp lệ.');
  const manifest = value as Partial<CommonManifest & LanguageManifest>;
  if (
    manifest.schema_version !== 1 ||
    manifest.release_id !== expected.releaseId ||
    manifest.version !== expected.version ||
    manifest.zone?.zone_id !== expected.zoneId
  ) {
    throw new Error('manifest.json không khớp zone, release hoặc version đang tải.');
  }
  if (kind === 'common') {
    if (!Array.isArray(manifest.pois)) throw new Error('Common Pack thiếu danh sách POI.');
    const ids = manifest.pois.map((poi) => poi?.poi_id);
    if (ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
      throw new Error('Common Pack chứa POI ID không hợp lệ.');
    }
    return manifest as CommonManifest;
  }
  if (
    !Array.isArray(manifest.content) ||
    manifest.language !== expected.language ||
    !commonPoiIds
  ) {
    throw new Error('Language Shard thiếu content hoặc không khớp ngôn ngữ.');
  }
  if (manifest.content.some((item) => !commonPoiIds.has(item?.poi_id))) {
    throw new Error('Language Shard tham chiếu POI không tồn tại trong Common Pack.');
  }
  return manifest as LanguageManifest;
}

async function extractZip(
  zipFile: File,
  destination: Directory,
  expected: {
    kind: 'common' | 'language';
    zoneId: string;
    releaseId: string;
    version: number;
    language?: string;
  },
  commonPoiIds?: Set<string>
) {
  if ((zipFile.size ?? 0) > MAX_ARTIFACT_BYTES) {
    throw new Error('Offline Pack vượt quá giới hạn kích thước trên thiết bị.');
  }
  const entries = unzipSync(await zipFile.bytes());
  const names = Object.keys(entries);
  if (names.length > MAX_ZIP_ENTRIES) {
    throw new Error('ZIP chứa quá nhiều file.');
  }
  if (!names.includes('manifest.json')) {
    throw new Error('ZIP không chứa manifest.json.');
  }
  const uncompressedSize = names.reduce((total, name) => {
    const size = entries[name].byteLength;
    if (size > MAX_ENTRY_BYTES) throw new Error('ZIP chứa file vượt quá giới hạn kích thước.');
    return total + size;
  }, 0);
  if (uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
    throw new Error('Dữ liệu giải nén vượt quá giới hạn trên thiết bị.');
  }

  let manifest: ZipManifest;
  try {
    manifest = validateManifest(
      JSON.parse(strFromU8(entries['manifest.json'])),
      expected.kind,
      expected,
      commonPoiIds
    );
  } catch (error) {
    throw error instanceof Error ? error : new Error('manifest.json không hợp lệ.');
  }

  ensureDirectory(destination);
  for (const name of names) {
    assertSafeZipPath(name);
    if (name !== 'manifest.json' && !name.startsWith('assets/')) {
      throw new Error('ZIP chứa đường dẫn file không được hỗ trợ.');
    }
    if (name.endsWith('/')) {
      ensureDirectory(new Directory(destination, ...name.slice(0, -1).split('/')));
      continue;
    }
    const parts = name.split('/');
    const fileName = parts.pop();
    if (!fileName) throw new Error('ZIP chứa tên file không hợp lệ.');
    const parent = new Directory(destination, ...parts);
    ensureDirectory(parent);
    const output = new File(parent, fileName);
    output.write(entries[name]);
  }
  return manifest;
}

function removeIfExists(path: File | Directory) {
  if (path.exists) path.delete();
}
const activeDownloads = new Set<string>();

async function downloadAndExtract(
  artifact: OfflinePackArtifact,
  destination: Directory,
  expected: {
    kind: 'common' | 'language';
    zoneId: string;
    releaseId: string;
    version: number;
    language?: string;
  },
  onProgress?: (progress: OfflineDownloadProgress) => void,
  commonPoiIds?: Set<string>
) {
  const parent = destination.parentDirectory;
  const destinationName = destination.name;
  const archiveName = `${destinationName}.zip`;
  const downloadName = `${destinationName}.download`;
  const pendingName = `${destinationName}.pending`;
  const backupName = `${destinationName}.backup`;
  const archiveBackupName = `${archiveName}.backup`;

  // Luôn tạo handle mới khi cần truy cập đường dẫn.
  const getDestination = () => new Directory(parent, destinationName);
  const getArchive = () => new File(parent, archiveName);
  const getTemporary = () => new File(parent, downloadName);
  const getPending = () => new Directory(parent, pendingName);
  const getBackup = () => new Directory(parent, backupName);
  const getArchiveBackup = () => new File(parent, archiveBackupName);

  ensureDirectory(parent);

  // 1. Kiểm tra và khôi phục trạng thái giao dịch cũ.
  const oldDestination = getDestination();
  const oldBackup = getBackup();

  if (oldBackup.exists && oldDestination.exists) {
    throw new Error(`Recovery conflict: cả ${destinationName} và ${backupName} đều tồn tại.`);
  }

  if (oldBackup.exists && !oldDestination.exists) {
    console.warn('[OfflinePack] Recovering directory backup...');
    await oldBackup.move(getDestination());
    console.log('[OfflinePack] Directory backup recovered.');
  }

  const oldArchive = getArchive();
  const oldArchiveBackup = getArchiveBackup();

  if (oldArchiveBackup.exists && oldArchive.exists) {
    throw new Error(`Recovery conflict: cả ${archiveName} và ${archiveBackupName} đều tồn tại.`);
  }

  if (oldArchiveBackup.exists && !oldArchive.exists) {
    console.warn('[OfflinePack] Recovering archive backup...');

    await verifyFile(oldArchiveBackup, artifact);

    await oldArchiveBackup.move(getArchive());

    console.log('[OfflinePack] Archive backup recovered.');
  }

  // Dọn file tạm từ lần chạy trước.
  removeIfExists(getTemporary());
  removeIfExists(getPending());

  const resumable = LegacyFileSystem.createDownloadResumable(
    resolveDownloadUrl(artifact.url),
    getTemporary().uri,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : artifact.size_bytes;

      onProgress?.({
        downloaded: totalBytesWritten,
        total,
        progress: Math.min(1, totalBytesWritten / total),
      });
    }
  );

  let oldDestinationMoved = false;
  let oldArchiveMoved = false;
  let newDestinationMoved = false;
  let newArchiveMoved = false;
  let committed = false;
  let moveStep = 'download ZIP';

  try {
    // 2. Download và xác minh ZIP.
    const result = await resumable.downloadAsync();

    if (!result?.uri) {
      throw new Error('Download không trả về file.');
    }

    await verifyFile(getTemporary(), artifact);

    // 3. Giải nén vào pending.
    moveStep = 'extract ZIP';

    const manifest = await extractZip(getTemporary(), getPending(), expected, commonPoiIds);

    // 4. Di chuyển dữ liệu cũ sang backup.
    if (getDestination().exists) {
      moveStep = 'move old destination to backup';

      await getDestination().move(getBackup());

      oldDestinationMoved = true;
    }

    if (getArchive().exists) {
      moveStep = 'move old archive to backup';

      await getArchive().move(getArchiveBackup());

      oldArchiveMoved = true;
    }

    // 5. Đưa dữ liệu mới vào vị trí chính.
    moveStep = 'move pending to destination';

    await getPending().move(getDestination());

    newDestinationMoved = true;

    moveStep = 'move temporary archive to archive';

    await getTemporary().move(getArchive());

    newArchiveMoved = true;

    // 6. Đánh dấu giao dịch hoàn tất.
    committed = true;

    // 7. Dọn backup sau khi cả hai thành phần đã được đặt thành công.
    try {
      removeIfExists(getBackup());
      removeIfExists(getArchiveBackup());
    } catch (cleanupError) {
      console.warn('[OfflinePack] Backup cleanup failed:', cleanupError);
    }

    console.log('[OfflinePack] Download transaction completed:', {
      destination: getDestination().uri,
      archive: getArchive().uri,
    });

    return manifest;
  } catch (error) {
    console.error(`[OfflinePack] Failed at step: ${moveStep}`, error);

    if (!committed) {
      try {
        // Xóa dữ liệu mới nếu đã được chuyển vào vị trí chính.
        if (newDestinationMoved) {
          removeIfExists(getDestination());
        }

        if (newArchiveMoved) {
          removeIfExists(getArchive());
        }

        // Khôi phục dữ liệu cũ bằng handle mới.
        if (oldDestinationMoved && getBackup().exists) {
          await getBackup().move(getDestination());
        }

        if (oldArchiveMoved && getArchiveBackup().exists) {
          await getArchiveBackup().move(getArchive());
        }
      } catch (rollbackError) {
        console.error('[OfflinePack] Rollback failed:', rollbackError);

        throw new Error(
          `Offline Pack lỗi tại "${moveStep}". Rollback cũng thất bại: ${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }`
        );
      }
    }

    throw new Error(
      `Offline Pack lỗi tại "${moveStep}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    // Tạo handle mới để tránh xóa nhầm file đích sau move().
    removeIfExists(getPending());

    if (!committed) {
      removeIfExists(getTemporary());
    }
  }
}

async function downloadOfflinePackUnlocked(
  manifest: OfflinePackManifest,
  languages: string[],
  onProgress?: (part: 'common' | string, progress: OfflineDownloadProgress) => void
) {
  ensureDirectory(offlineRoot);
  const releaseRoot = new Directory(offlineRoot, manifest.zone_id, `v${manifest.version}`);
  ensureDirectory(releaseRoot);
  const current = await loadMetadata();
  const previous = current[manifest.zone_id];
  const commonPath = new Directory(releaseRoot, 'common');
  const commonArchive = new File(releaseRoot, 'common.zip');
  let commonValid = false;
  let commonManifest: CommonManifest | null = null;
  if (
    previous?.release_id === manifest.release_id &&
    previous.version === manifest.version &&
    previous.common.sha256 === manifest.common_pack.sha256 &&
    commonPath.exists &&
    commonArchive.exists
  ) {
    try {
      await verifyFile(commonArchive, manifest.common_pack);
      commonManifest = validateManifest(
        await new File(commonPath, 'manifest.json').json(),
        'common',
        {
          zoneId: manifest.zone_id,
          releaseId: manifest.release_id,
          version: manifest.version,
        }
      ) as CommonManifest;
      commonValid = true;
    } catch {
      commonValid = false;
    }
  }

  if (!commonValid) {
    commonManifest = (await downloadAndExtract(
      manifest.common_pack,
      commonPath,
      {
        kind: 'common',
        zoneId: manifest.zone_id,
        releaseId: manifest.release_id,
        version: manifest.version,
      },
      (progress) => onProgress?.('common', progress)
    )) as CommonManifest;
  }

  const storedLanguages = { ...(commonValid ? previous?.languages : {}) };
  const commonMetadata = {
    ...manifest.common_pack,
    local_path: commonPath.uri,
    archive_path: commonArchive.uri,
    downloaded_at: new Date().toISOString(),
  };
  await saveMetadata({
    ...current,
    [manifest.zone_id]: {
      zone_id: manifest.zone_id,
      release_id: manifest.release_id,
      version: manifest.version,
      status: 'partial',
      common: commonMetadata,
      languages: storedLanguages,
    },
  });
  for (const language of languages) {
    const artifact = manifest.language_shards.find((item) => item.language_code === language);
    if (!artifact) throw new Error(`Không tìm thấy shard ${language} trong manifest.`);
    const languagePath = new Directory(releaseRoot, language);
    const languageArchive = new File(releaseRoot, `${language}.zip`);
    let languageValid =
      previous?.release_id === manifest.release_id &&
      storedLanguages[language]?.sha256 === artifact.sha256 &&
      languagePath.exists &&
      languageArchive.exists;
    if (languageValid) {
      try {
        await verifyFile(languageArchive, artifact);
        validateManifest(
          await new File(languagePath, 'manifest.json').json(),
          'language',
          {
            zoneId: manifest.zone_id,
            releaseId: manifest.release_id,
            version: manifest.version,
            language,
          },
          new Set(commonManifest?.pois.map((poi) => poi.poi_id))
        );
      } catch {
        languageValid = false;
      }
    }
    if (!languageValid) {
      await downloadAndExtract(
        artifact,
        languagePath,
        {
          kind: 'language',
          zoneId: manifest.zone_id,
          releaseId: manifest.release_id,
          version: manifest.version,
          language,
        },
        (progress) => onProgress?.(language, progress),
        new Set(commonManifest?.pois.map((poi) => poi.poi_id) ?? [])
      );
    }
    storedLanguages[language] = {
      ...artifact,
      local_path: languagePath.uri,
      archive_path: languageArchive.uri,
      downloaded_at: new Date().toISOString(),
    };
    await saveMetadata({
      ...current,
      [manifest.zone_id]: {
        zone_id: manifest.zone_id,
        release_id: manifest.release_id,
        version: manifest.version,
        status: 'partial',
        common: commonMetadata,
        languages: storedLanguages,
      },
    });
  }

  const next: OfflinePackMetadata = {
    zone_id: manifest.zone_id,
    release_id: manifest.release_id,
    version: manifest.version,
    status: 'ready',
    common: {
      ...commonMetadata,
    },
    languages: storedLanguages,
  };
  await saveMetadata({ ...current, [manifest.zone_id]: next });
  return next;
}
export async function downloadOfflinePack(
  manifest: OfflinePackManifest,
  languages: string[],
  onProgress?: (part: 'common' | string, progress: OfflineDownloadProgress) => void
) {
  const lockKey = `${manifest.zone_id}:v${manifest.version}`;

  if (activeDownloads.has(lockKey)) {
    throw new Error('Offline Pack này đang được tải. Vui lòng đợi tiến trình hiện tại hoàn tất.');
  }

  activeDownloads.add(lockKey);

  try {
    return await downloadOfflinePackUnlocked(manifest, languages, onProgress);
  } finally {
    activeDownloads.delete(lockKey);
  }
}
