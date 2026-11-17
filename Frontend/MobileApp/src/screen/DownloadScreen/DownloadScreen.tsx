import { IconDownload, IconTrash } from '@/components/Icons';
import { useApp } from '@/store/AppContext';
import {
  fetchOfflineReleases,
  installOffline,
  listOfflineInstalls,
  removeOffline,
  type OfflineInstall,
  type OfflineRelease,
} from '@/services/offlineService';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';

export default function DownloadScreen() {
  const { t } = useTranslation();
  const { wifiOnly, reloadPOIs } = useApp();
  const [releases, setReleases] = useState<OfflineRelease[]>([]);
  const [installed, setInstalled] = useState<OfflineInstall[]>([]);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
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

  async function download(release: OfflineRelease, locale: string) {
    setBusy(`${release.id}:${locale}`);
    setProgress(0);
    try {
      await installOffline(release, locale, wifiOnly, (value) => {
        if (mounted.current) setProgress(value);
      });
      reloadPOIs();
      if (mounted.current) setRefresh((value) => value + 1);
    } catch (error) {
      if (mounted.current)
        Alert.alert(
          t('download.title'),
          error instanceof Error && error.message === 'OFFLINE_WIFI_REQUIRED'
            ? t('offline.wifiRequired')
            : t('offline.failed')
        );
    } finally {
      if (mounted.current) setBusy('');
    }
  }

  function remove(install: OfflineInstall) {
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
              if (mounted.current) setRefresh((value) => value + 1);
            } catch {
              if (mounted.current) Alert.alert(t('download.title'), t('offline.failed'));
            } finally {
              if (mounted.current) setBusy('');
            }
          })();
        },
      },
    ]);
  }

  const bytes = installed.reduce((total, item) => total + item.bytes, 0);
  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 pb-8 pt-4">
        <View className="mb-4 rounded-2xl bg-white p-4">
          <Text className="text-xl font-extrabold text-slate-900">{t('download.title')}</Text>
          <Text className="mt-2 text-sm text-teal-700">
            {t('offline.saved', {
              count: installed.length,
              size: (bytes / 1024 / 1024).toFixed(2),
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
        {Platform.OS === 'web' && (
          <Text className="mb-4 text-sm text-orange-800">{t('offline.nativeOnly')}</Text>
        )}
        {loadError && (
          <Text className="mb-4 text-sm text-orange-800">{t('connection.unavailable')}</Text>
        )}
        {installed.map((install) => (
          <View
            key={install.key}
            className="mb-3 flex-row items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 p-4"
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
              onPress={() => remove(install)}
              accessibilityLabel={t('offline.removeTitle')}
              accessibilityRole="button"
              className="p-3"
            >
              <IconTrash size={20} color="#dc2626" />
            </Pressable>
          </View>
        ))}
        <Text className="mb-3 mt-3 text-sm font-bold uppercase text-slate-600">
          {t('offline.published')}
        </Text>
        {!releases.length && !loadError && (
          <Text className="text-sm text-slate-500">{t('offline.empty')}</Text>
        )}
        {releases.map((release) => (
          <View key={release.id} className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="text-base font-bold text-slate-800">
              {release.zone_name} · v{release.version}
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              {t('download.points', { count: release.poi_count })}
            </Text>
            {release.languages.map((part) => {
              const key = `${release.id}:${part.language_code}`;
              const exists = installed.some((item) => item.key === key);
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
                      void download(release, part.language_code);
                    }}
                    accessibilityRole="button"
                    className={`flex-row items-center gap-2 rounded-xl px-4 py-3 ${exists || busy ? 'bg-slate-100' : 'bg-teal-600'}`}
                  >
                    <IconDownload size={16} color={exists || busy ? '#475569' : '#ffffff'} />
                    <Text
                      className={exists || busy ? 'text-slate-600' : 'font-semibold text-white'}
                    >
                      {busy === key
                        ? `${progress}%`
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
      </ScrollView>
    </View>
  );
}
