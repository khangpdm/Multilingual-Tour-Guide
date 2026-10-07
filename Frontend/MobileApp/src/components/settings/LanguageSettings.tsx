import { IconCheck } from '@/components/Icons';
import { Language } from '@/store/AppContext';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

const languages: { code: Language; label: string; name: string }[] = [
  { code: 'vi', label: 'VN', name: 'Tiếng Việt' },
  { code: 'en', label: 'US', name: 'English' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'ja', label: 'JP', name: '日本語' },
  { code: 'ko', label: 'KR', name: '한국어' },
  { code: 'zh', label: 'CN', name: '中文' },
];

function LanguageOption({
  item,
  selected,
  onPress,
}: {
  item: (typeof languages)[number];
  selected: boolean;
  onPress: (language: Language) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(item.code)}
      className={`h-[38px] flex-1 justify-center rounded-[10px] border px-[11px] ${
        selected ? 'border-[#0aa99d] bg-[#effcfb]' : 'border-[#edf0f4] bg-[#f8fafc]'
      }`}
    >
      <View className="flex-row items-center gap-[9px]">
        <Text className="text-[10px] font-bold text-[#102d4f]">{item.label}</Text>
        <Text className="text-[11px] text-[#102d4f]">{item.name}</Text>
        {selected && <IconCheck size={14} color="#0aa99d" />}
      </View>
    </Pressable>
  );
}

export default function LanguageSettings({
  language,
  onLanguageChange,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  return (
    <View className="rounded-2xl bg-white p-3 shadow-sm">
      <Text className="mb-2 text-[10px] text-[#8796ad]">
        Ngôn ngữ giao diện và thuyết minh
      </Text>
      <View className="gap-[6px]">
        {[languages.slice(0, 2), languages.slice(2, 4), languages.slice(4, 6)].map(
          (row, index) => (
            <View key={index} className="flex-row gap-[6px]">
              {row.map((item) => (
                <LanguageOption
                  key={item.code}
                  item={item}
                  selected={language === item.code}
                  onPress={onLanguageChange}
                />
              ))}
            </View>
          )
        )}
      </View>
    </View>
  );
}
