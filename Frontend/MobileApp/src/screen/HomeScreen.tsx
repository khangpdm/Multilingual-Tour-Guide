import { IconChevronDown } from '@/components/Icons';
import Mapsection from '@/components/MapSection';
import { useApp } from '@/store/AppContext';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LANGS = [
  { code: 'vi' as const, flag: '🇻🇳', name: 'Tiếng Việt' },
  { code: 'en' as const, flag: '🇺🇸', name: 'English' },
  { code: 'fr' as const, flag: '🇫🇷', name: 'Français' },
  { code: 'ja' as const, flag: '🇯🇵', name: '日本語' },
  { code: 'ko' as const, flag: '🇰🇷', name: '한국어' },
  { code: 'zh' as const, flag: '🇨🇳', name: '中文' },
];

export default function HomeScreen() {
  const { language, setLanguage } = useApp();
  const currentLang = LANGS.find((l) => l.code === language);
  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* HEADER */}
      <View className="z-10 flex-row items-center justify-between bg-white px-4 pb-2.5 pt-3 shadow-sm">
        <Text className="text-2xl font-extrabold tracking-tight text-teal-600">VietGuide</Text>

        <TouchableOpacity
          //   onPress={() => setLanguageMenuOpen(true)}
          activeOpacity={0.7}
          className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5"
        >
          <Text>{currentLang?.flag}</Text>
          <Text className="text-xs font-semibold uppercase text-gray-700">{language}</Text>
          <IconChevronDown size={12} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 relative">
        <Mapsection />
      </View>
    </SafeAreaView>
  );
}
