import { IconChevronRight } from '@/components/Icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import SettingsToggle from './SettingsToggle';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/store/AppContext';

export default function OfflineSettings({
  wifiOnly,
  onWifiOnlyChange,
}: {
  wifiOnly: boolean;
  onWifiOnlyChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const { offlineBytes, setActiveTab } = useApp();
  return (
    <View className="rounded-2xl bg-white p-[14px] shadow-sm">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[12px] font-semibold text-[#102d4f]">{t('settings.wifiOnly')}</Text>
          <Text className="mt-[3px] text-[10px] text-[#8796ad]">
            {t('settings.saveMobileData')}
          </Text>
        </View>
        <SettingsToggle value={wifiOnly} onChange={onWifiOnlyChange} />
      </View>
      <View className="mt-[14px] border-t border-[#f0f2f5] pt-[14px]">
        <View className="flex-row items-center justify-between">
          <Text className="text-[12px] text-[#102d4f]">{t('settings.downloadedStorage')}</Text>
          <Text className="text-[12px] text-[#102d4f]">
            {(offlineBytes / 1024 / 1024).toFixed(2)} MB
          </Text>
        </View>
        <Pressable
          onPress={() => setActiveTab('download')}
          className="mt-4 flex-row items-center justify-between"
        >
          <Text className="text-[12px] font-semibold text-[#0aa99d]">
            {t('settings.manageOffline')}
          </Text>
          <IconChevronRight color="#0aa99d" size={16} />
        </Pressable>
      </View>
    </View>
  );
}
