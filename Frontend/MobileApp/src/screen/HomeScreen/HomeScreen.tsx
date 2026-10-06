import { IconChevronDown } from '@/components/Icons';
import Mapsection from '@/components/MapSection';
import SearchPOI from '@/components/SearchPOI';
import { POIS, haversineDistance } from '@/data/pois';
import { useApp } from '@/store/AppContext';
import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import NearbyPOI from './components/NearbyPOI';
import PreviewPOI from './components/PreviewPOI';

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

  const nearbyPOIs = useMemo(() => {
    return POIS.filter(
      (p) => haversineDistance(userLat, userLng, p.lat, p.lng) <= activationRadius
    );
  }, [userLat, userLng, activationRadius]);

  const selectedPOI = useMemo(() => {
    if (!selectedMapPOIId) return null;
    return POIS.find((p) => p.id === selectedMapPOIId) || null;
  }, [selectedMapPOIId]);

  const searchResults = useMemo(() => {
    if (!homeSearch.trim()) return [];
    const query = homeSearch.toLowerCase().trim();
    return POIS.filter((p) => {
      const name =
        typeof p.name === 'object' ? p.name[language as keyof typeof p.name] || p.name.vi : p.name;
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
          activeOpacity={0.7}
          className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5"
        >
          <Text>{currentLang?.flag}</Text>
          <Text className="text-xs font-semibold uppercase text-gray-700">{language}</Text>
          <IconChevronDown size={12} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR & OVERLAY RESULTS */}
      <SearchPOI
        homeSearch={homeSearch}
        setHomeSearch={setHomeSearch}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        searchResults={searchResults}
        language={language}
        userLat={userLat}
        userLng={userLng}
        onSelectPOI={(id) => setSelectedMapPOIId(id)}
      />

      <View className="relative flex-1">
        <Mapsection onMapTouch={() => setSearchOpen(false)} />

        {/* POIS Ở GẦN */}
        {!selectedPOI && (
          <NearbyPOI
            nearbyPOIs={nearbyPOIs}
            language={language}
            userLat={userLat}
            userLng={userLng}
            onSelectPOI={(id) => setSelectedMapPOIId(id)}
          />
        )}

        {/* POI BOTTOM SHEET PREVIEW */}
        {selectedPOI && (
          <PreviewPOI
            selectedPOI={selectedPOI}
            language={language}
            userLat={userLat}
            userLng={userLng}
            onClose={() => setSelectedMapPOIId(null)}
            onStartPlayback={startPlayback}
            onOpenPOI={openPOI}
          />
        )}
      </View>
    </View>
  );
}
