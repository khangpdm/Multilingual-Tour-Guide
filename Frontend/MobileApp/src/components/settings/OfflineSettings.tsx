import { IconChevronRight } from '@/components/Icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import SettingsToggle from './SettingsToggle';

export default function OfflineSettings({
  wifiOnly,
  onWifiOnlyChange,
}: {
  wifiOnly: boolean;
  onWifiOnlyChange: (value: boolean) => void;
}) {
  return (
    <View className="rounded-2xl bg-white p-[14px] shadow-sm">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[12px] font-semibold text-[#102d4f]">Chỉ tải qua Wi-Fi</Text>
          <Text className="mt-[3px] text-[10px] text-[#8796ad]">
            Tiết kiệm dữ liệu di động
          </Text>
        </View>
        <SettingsToggle value={wifiOnly} onChange={onWifiOnlyChange} />
      </View>
      <View className="mt-[14px] border-t border-[#f0f2f5] pt-[14px]">
        <View className="flex-row items-center justify-between">
          <Text className="text-[12px] text-[#102d4f]">Dung lượng đã tải</Text>
          <Text className="text-[12px] text-[#102d4f]">45 MB</Text>
        </View>
        <Pressable className="mt-4 flex-row items-center justify-between">
          <Text className="text-[12px] font-semibold text-[#0aa99d]">Quản lý gói offline</Text>
          <IconChevronRight color="#0aa99d" size={16} />
        </Pressable>
      </View>
    </View>
  );
}
