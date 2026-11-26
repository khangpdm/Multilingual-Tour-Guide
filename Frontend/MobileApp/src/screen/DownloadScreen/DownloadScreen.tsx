import { IconDownload, IconFlash, IconTrash, IconWifi } from '@/components/Icons';
import { useApp } from '@/store/AppContext';
import {
  fetchOfflineReleases,
  installOffline,
  listOfflineInstalls,
  removeOffline,
  type OfflineInstall,
  type OfflineRelease,
} from '@/services/offlineService';
import {
  fetchOfflineManifest,
  fetchOfflineZones,
  downloadOfflinePack,
  getOfflinePackMetadata,
  type OfflinePackManifest,
  type OfflinePackMetadata,
  type OfflineZone,
  type OfflineDownloadProgress,
} from '@/services/offlinePackService';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

function sizeLabel(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu Offline Pack.';
}

export default function DownloadScreen() {
  const { t } = useTranslation();
  const { wifiOnly, reloadPOIs } = useApp();

  const [releases, setReleases] = useState<OfflineRelease[]>([]);
  const [installed, setInstalled] = useState<OfflineInstall[]>([]);
  const [busy, setBusy] = useState('');
  const [legacyProgress, setLegacyProgress] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let closed = false;

    void listOfflineInstalls()
      .then((items) => {
        if (!closed) setInstalled(items);
      })
      .catch(() => {
        if (!closed) setLoadError(true);
      });

    void fetchOfflineReleases()
      .then((items) => {
        if (!closed) {
          setReleases(items);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!closed) setLoadError(true);
      });

    return () => {
      closed = true;
      mounted.current = false;
    };
  }, [refresh]);
  const [zones, setZones] = useState<OfflineZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [languages, setLanguages] = useState(['vi']);
  const [manifest, setManifest] = useState<OfflinePackManifest | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const [metadata, setMetadata] = useState<Record<string, OfflinePackMetadata>>({});
  const [progress, setProgress] = useState<Record<string, OfflineDownloadProgress>>({});
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const selectionKey = `${selectedZoneId}:${languages.join(',')}`;
  const manifestMatchesSelection =
    manifest?.zone_id === selectedZoneId &&
    manifest.language_shards.every((shard) => languages.includes(shard.language_code));
  const loadingManifest = Boolean(
    selectedZoneId && languages.length > 0 && !manifestMatchesSelection && errorKey !== selectionKey
  );

  useEffect(() => {
    let active = true;
    fetchOfflineZones()
      .then((result) => {
        if (!active) return;
        setZones(result);
        setSelectedZoneId((current) => current || result[0]?.zone_id || '');
        setError('');
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoadingZones(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedZoneId || languages.length === 0) {
      return;
    }
    let active = true;
    fetchOfflineManifest(selectedZoneId, languages)
      .then((result) => {
        if (!active) return;
        setManifest(result);
        setError('');
        setErrorKey('');
      })
      .catch((reason: unknown) => {
        if (active) {
          setManifest(null);
          setError(errorMessage(reason));
          setErrorKey(selectionKey);
        }
      });

    return () => {
      active = false;
    };
  }, [languages, selectedZoneId, selectionKey]);

  useEffect(() => {
    getOfflinePackMetadata()
      .then(setMetadata)
      .catch((reason: unknown) => setDownloadError(errorMessage(reason)));
  }, []);

  async function downloadResource(release: OfflineRelease, locale: string) {
    const key = `${release.id}:${locale}`;

    setBusy(key);
    setLegacyProgress(0);

    try {
      await installOffline(release, locale, wifiOnly, (value) => {
        if (mounted.current) setLegacyProgress(value);
      });

      reloadPOIs();

      if (mounted.current) {
        setRefresh((value) => value + 1);
      }
    } catch (error) {
      if (mounted.current) {
        Alert.alert(
          t('download.title'),
          error instanceof Error && error.message === 'OFFLINE_WIFI_REQUIRED'
            ? t('offline.wifiRequired')
            : t('offline.failed')
        );
      }
    } finally {
      if (mounted.current) setBusy('');
    }
  }

  function removeResource(install: OfflineInstall) {
    Alert.alert(t('offline.removeTitle'), install.zoneName, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(install.key);

            try {
              await removeOffline(install.key);
              reloadPOIs();

              if (mounted.current) {
                setRefresh((value) => value + 1);
              }
            } catch {
              if (mounted.current) {
                Alert.alert(t('download.title'), t('offline.failed'));
              }
            } finally {
              if (mounted.current) setBusy('');
            }
          })();
        },
      },
    ]);
  }
  const toggleLanguage = (language: string) => {
    setLanguages((current) =>
      current.includes(language)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== language)
        : [...current, language]
    );
  };

  const startDownload = async () => {
    if (!manifest || downloading) return;
    setDownloading(true);
    setDownloadError('');
    setProgress({});
    try {
      const saved = await downloadOfflinePack(manifest, languages, (part, value) => {
        setProgress((current) => ({ ...current, [part]: value }));
      });
      setMetadata((current) => ({ ...current, [saved.zone_id]: saved }));
      reloadPOIs();
    } catch (reason: unknown) {
      setDownloadError(errorMessage(reason));
    } finally {
      setDownloading(false);
    }
  };

  const offlineResourceBytes = installed.reduce((total, item) => total + item.bytes, 0);
  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <View className="border-b border-slate-100 bg-white px-4 pb-4 pt-3">
          <Text className="text-[20px] font-extrabold text-slate-900">{t('download.title')}</Text>
          <View className="mt-3 flex-row items-center rounded-2xl bg-teal-50 px-4 py-3">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
              <IconDownload size={20} color="#0d9488" />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-bold text-teal-700">Offline Pack</Text>
              <Text className="mt-0.5 text-[11px] text-teal-600">
                Chọn Zone và ngôn ngữ để xem manifest từ máy chủ.
              </Text>
            </View>
            <Pressable className="flex-row items-center rounded-full bg-teal-500 px-4 py-2">
              <IconWifi size={14} color="#FFFFFF" />
              <Text className="ml-1.5 text-[12px] font-bold text-white">Wi-Fi</Text>
            </Pressable>
          </View>

          <View className="mt-2.5 flex-row items-center justify-center">
            <IconFlash size={12} color="#f97316" />
            <Text className="ml-1.5 text-[11px] text-slate-400">{t('download.wifiOnly')}</Text>
          </View>
        </View>

        <View className="px-4 pt-4">
          {error && errorKey === selectionKey ? (
            <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <Text className="font-semibold text-red-700">Không thể tải Offline Pack</Text>
              <Text className="mt-1 text-[12px] text-red-600">{error}</Text>
            </View>
          ) : null}
          {downloadError ? (
            <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <Text className="font-semibold text-red-700">Download thất bại</Text>
              <Text className="mt-1 text-[12px] text-red-600">{downloadError}</Text>
            </View>
          ) : null}

          <Text className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            Khu vực
          </Text>
          {loadingZones ? (
            <ActivityIndicator color="#0d9488" />
          ) : zones.length === 0 ? (
            <Text className="rounded-2xl bg-white p-4 text-slate-500">
              Chưa có Zone khả dụng cho Offline Pack.
            </Text>
          ) : (
            zones.map((zone) => (
              <Pressable
                key={zone.zone_id}
                onPress={() => setSelectedZoneId(zone.zone_id)}
                className={`mb-2 rounded-2xl border p-4 ${
                  selectedZoneId === zone.zone_id
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <Text className="font-bold text-slate-800">{zone.name}</Text>
                <Text className="mt-1 text-[11px] text-slate-500">{zone.zone_id}</Text>
              </Pressable>
            ))
          )}

          <Text className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            Ngôn ngữ
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {['vi', 'en', 'fr', 'ja', 'ko', 'zh'].map((language) => (
              <Pressable
                key={language}
                onPress={() => toggleLanguage(language)}
                className={`rounded-full border px-4 py-2 ${
                  languages.includes(language)
                    ? 'border-teal-500 bg-teal-500'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <Text
                  className={`text-[12px] font-semibold ${
                    languages.includes(language) ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {language.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {loadingManifest ? (
            <ActivityIndicator className="mt-6" color="#0d9488" />
          ) : manifest && manifestMatchesSelection ? (
            <View className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="font-bold text-slate-800">Release v{manifest.version}</Text>
              <Text className="mt-1 text-[11px] text-slate-500">{manifest.release_id}</Text>
              <Text className="mt-4 font-semibold text-slate-700">Common Pack</Text>
              <Text className="mt-1 text-[12px] text-slate-500">
                {sizeLabel(manifest.common_pack.size_bytes)}
              </Text>
              {manifest.language_shards.map((shard) => (
                <View key={shard.language_code} className="mt-3 border-t border-slate-100 pt-3">
                  <Text className="font-semibold text-slate-700">
                    {shard.language_code.toUpperCase()} Shard
                  </Text>
                  <Text className="mt-1 text-[12px] text-slate-500">
                    {sizeLabel(shard.size_bytes)}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={startDownload}
                disabled={downloading}
                className={`mt-5 items-center rounded-xl px-4 py-3 ${
                  downloading ? 'bg-slate-300' : 'bg-teal-500'
                }`}
              >
                <Text className="font-bold text-white">
                  {downloading ? 'Đang tải...' : 'Tải Offline Pack'}
                </Text>
              </Pressable>
              {Object.entries(progress).map(([part, value]) => (
                <View key={part} className="mt-3">
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] font-semibold text-slate-600">
                      {part === 'common' ? 'Common' : part.toUpperCase()}
                    </Text>
                    <Text className="text-[11px] text-slate-500">
                      {Math.round(value.progress * 100)}%
                    </Text>
                  </View>
                  <View className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <View
                      className="h-full bg-teal-500"
                      style={{ width: `${Math.round(value.progress * 100)}%` }}
                    />
                  </View>
                </View>
              ))}
              {metadata[manifest.zone_id]?.release_id === manifest.release_id &&
              metadata[manifest.zone_id].status === 'ready' ? (
                <Text className="mt-4 text-[12px] font-semibold text-teal-700">
                  Đã lưu Offline Pack v{metadata[manifest.zone_id].version}
                </Text>
              ) : metadata[manifest.zone_id]?.release_id === manifest.release_id ? (
                <Text className="mt-4 text-[12px] font-semibold text-amber-700">
                  Common Pack đã lưu; một hoặc nhiều Language Shard chưa hoàn tất.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Offline Resource - hệ thống tải dữ liệu cũ từ develop */}
        <View className="mx-4 mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <Text className="text-base font-extrabold text-slate-900">{t('offline.published')}</Text>

          <Text className="mt-2 text-sm text-teal-700">
            {t('offline.saved', {
              count: installed.length,
              size: (offlineResourceBytes / 1024 / 1024).toFixed(2),
            })}
          </Text>

          <Text className="mt-2 text-xs text-slate-500">{t('offline.explanation')}</Text>

          <Pressable
            onPress={() => setRefresh((value) => value + 1)}
            disabled={!!busy}
            accessibilityRole="button"
          >
            <Text className="mt-3 font-semibold text-teal-700">{t('offline.refresh')}</Text>
          </Pressable>
        </View>

        {Platform.OS === 'web' ? (
          <Text className="mx-4 mt-3 text-sm text-orange-800">{t('offline.nativeOnly')}</Text>
        ) : null}

        {loadError ? (
          <Text className="mx-4 mt-3 text-sm text-orange-800">{t('connection.unavailable')}</Text>
        ) : null}

        {/* Các Offline Resource đã cài */}
        <View className="px-4">
          {installed.map((install) => (
            <View
              key={install.key}
              className="mb-3 mt-3 flex-row items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 p-4"
            >
              <View className="flex-1">
                <Text className="font-bold text-slate-800">
                  {install.zoneName} · v{install.version}
                </Text>

                <Text className="mt-1 text-sm text-teal-700">
                  {install.language.toUpperCase()} + EN · {t('offline.ready')}
                </Text>
              </View>

              <Pressable
                disabled={!!busy}
                onPress={() => removeResource(install)}
                accessibilityLabel={t('offline.removeTitle')}
                accessibilityRole="button"
                className="p-3"
              >
                <IconTrash size={20} color="#dc2626" />
              </Pressable>
            </View>
          ))}

          <Text className="mb-3 mt-4 text-sm font-bold uppercase text-slate-600">
            {t('offline.published')}
          </Text>

          {!releases.length && !loadError ? (
            <Text className="text-sm text-slate-500">{t('offline.empty')}</Text>
          ) : null}

          {releases.map((release) => (
            <View
              key={release.id}
              className="mb-4 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <Text className="text-base font-bold text-slate-800">
                {release.zone_name} · v{release.version}
              </Text>

              <Text className="mt-1 text-sm text-slate-500">
                {t('download.points', { count: release.poi_count })}
              </Text>

              {release.languages.map((part) => {
                const key = `${release.id}:${part.language_code}`;
                const exists = installed.some((item) => item.key === key);
                const isBusy = busy === key;

                return (
                  <View
                    key={key}
                    className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-3"
                  >
                    <Text className="font-semibold text-slate-700">
                      {part.language_code.toUpperCase()}
                    </Text>

                    <Pressable
                      disabled={!!busy || exists || Platform.OS === 'web'}
                      onPress={() => {
                        void downloadResource(release, part.language_code);
                      }}
                      accessibilityRole="button"
                      className={`flex-row items-center gap-2 rounded-xl px-4 py-3 ${
                        exists || busy ? 'bg-slate-100' : 'bg-teal-600'
                      }`}
                    >
                      <IconDownload size={16} color={exists || busy ? '#475569' : '#ffffff'} />

                      <Text
                        className={exists || busy ? 'text-slate-600' : 'font-semibold text-white'}
                      >
                        {isBusy
                          ? `${legacyProgress}%`
                          : exists
                            ? t('offline.ready')
                            : t('offline.download')}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
