import { IconChevronDown, IconClose, IconPlay, IconSearch } from '@/components/Icons';
import Mapsection from '@/components/MapSection';
import { CATEGORY_COLORS, POIS, formatDistance, haversineDistance } from '@/data/pois';
import { useApp } from '@/store/AppContext';
import { useMemo, useState } from 'react';
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';

const LANGS = [
  { code: 'vi' as const, flag: '🇻🇳', name: 'Tiếng Việt' },
  { code: 'en' as const, flag: '🇺🇸', name: 'English' },
  { code: 'fr' as const, flag: '🇫🇷', name: 'Français' },
  { code: 'ja' as const, flag: '🇯🇵', name: '日本語' },
  { code: 'ko' as const, flag: '🇰🇷', name: '한국어' },
  { code: 'zh' as const, flag: '🇨🇳', name: '中文' },
];

export default function HomeScreen() {
  const {
    language,
    setLanguage,
    langMenuOpen,
    setLangMenuOpen,
    homeSearch,
    setHomeSearch,
    selectedMapPOIId,
    setSelectedMapPOIId,
    openPOI,
    userLat,
    userLng,
    activationRadius,
    startPlayback,
  } = useApp();

  const [searchOpen, setSearchOpen] = useState(false);

  const currentLang = LANGS.find((l) => l.code === language);

  const selectedPOI = useMemo(() => {
    if (!selectedMapPOIId) return null;
    return POIS.find((p) => p.id === selectedMapPOIId) || null;
  }, [selectedMapPOIId]);

  const searchResults = useMemo(() => {
    if (!homeSearch.trim()) return [];
    const query = homeSearch.toLowerCase().trim();
    return POIS.filter((p) => {
      const name = typeof p.name === 'object' ? p.name[language] || p.name.vi : p.name;
      const address = p.address || '';
      return name.toLowerCase().includes(query) || address.toLowerCase().includes(query);
    });
  }, [homeSearch, language]);

  return (
    <View className="flex-1 bg-white">
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

      {/* SEARCH BAR & OVERLAY RESULTS */}
      <View className="z-20 bg-white px-4 pb-3">
        <View className="realtive flex-row items-center bg-gray-100 rounded-xl px-3 py-1">
          <IconSearch size={16} color="#9CA3AF" />

          <TextInput
            value={homeSearch}
            onChangeText={(text) => {
              setHomeSearch(text);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Tìm địa chỉ bạn muốn khám phá..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 py-2 px-2 text-sm text-gray-800"
          />

          {homeSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setHomeSearch('');
                setSearchOpen(false);
              }}
              className="p-1"
            >
              <IconClose size={14} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="flex-1 relative">
        <Mapsection />

        {/* POI BOTTOM SHEET PREVIEW */}
        {selectedPOI && (
          <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-t-2xl shadow-2xl border-t border-gray-100">
            <View className="items-center pt-2.5 pb-1">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>

            <View className="flex-row gap-3 px-4 pb-4">
              <Image
                source={{ uri: selectedPOI.coverImage }}
                className="w-16 h-16 rounded-xl bg-gray-100"
              />

              <View className="flex-1">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-bold text-gray-800" numberOfLines={1}>
                      {typeof selectedPOI.name === 'object'
                        ? selectedPOI.name[language] || selectedPOI.name.vi
                        : selectedPOI.name}
                    </Text>
                    <View
                      className="self-start mt-1 px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: CATEGORY_COLORS[selectedPOI.category] || '#0D9488',
                      }}
                    >
                      <Text className="text-[10px] font-semibold text-white">
                        {selectedPOI.category}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity onPress={() => setSelectedMapPOIId(null)} className="p-1">
                    <IconClose size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <Text className="text-xs text-orange-500 font-medium mt-1">
                  {formatDistance(
                    haversineDistance(userLat, userLng, selectedPOI.lat, selectedPOI.lng)
                  )}{' '}
                  từ bạn
                </Text>
              </View>
            </View>

            <View className="flex-row gap-2 px-4 pb-4">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => startPlayback(selectedPOI.id)}
                className="flex-1 flex-row items-center justify-center gap-2 bg-teal-600 py-2.5 rounded-xl active:bg-teal-700"
              >
                <IconPlay size={14} color="#FFFFFF" />
                <Text className="text-white text-sm font-semibold">Nghe thuyết minh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  openPOI(selectedPOI.id);
                  setSelectedMapPOIId(null);
                }}
                className="flex-1 flex-row items-center justify-center gap-2 border-2 border-teal-600 py-2.5 rounded-xl active:bg-teal-50"
              >
                <Text className="text-teal-600 text-sm font-semibold">Xem chi tiết</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
