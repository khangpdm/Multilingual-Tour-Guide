import { Tab, useApp } from '@/store/AppContext';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconCompass, IconDownload, IconHome, IconQr, IconSettings } from './Icons';

const TABS: {
  id: Tab;
  label: string;
  Icon: React.ComponentType<{
    size?: number;
    color?: string;
    className?: string;
  }>;
}[] = [
  { id: 'home', label: 'Trang chủ', Icon: IconHome },
  { id: 'explore', label: 'Khám phá', Icon: IconCompass },
  { id: 'scan', label: 'Quét QR', Icon: IconQr },
  { id: 'download', label: 'Tải về', Icon: IconDownload },
  { id: 'settings', label: 'Cài đặt', Icon: IconSettings },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="w-full flex-row bg-white border-t border-gray-200"
      style={{ paddingBottom: insets.bottom }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        const isCenter = id === 'scan';

        return (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveTab(id)}
            activeOpacity={0.7}
            className="flex-1 flex-col items-center justify-center gap-0.5 py-2 relative"
            style={{ minHeight: 56 }}
          >
            {isCenter ? (
              <View
                className="items-center justify-center rounded-2xl mb-0.5"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: '#0d9488',
                  marginTop: -12,
                  // Shadow tương đương `0 4px 12px rgba(13,148,136,0.4)`
                  shadowColor: '#0d9488',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 6,
                  elevation: 6,
                }}
              >
                <Icon size={22} color="#FFFFFF" className="text-white" />
              </View>
            ) : (
              <Icon
                size={22}
                color={active ? '#0d9488' : '#9ca3af'}
                className={active ? 'text-teal-600' : 'text-gray-400'}
              />
            )}

            <Text
              className="text-[10px] font-medium leading-none"
              style={{
                color: isCenter ? (active ? '#0d9488' : '#6b7280') : active ? '#0d9488' : '#9ca3af',
              }}
            >
              {label}
            </Text>

            {active && !isCenter && (
              <View className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-teal-600" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
