import { IconChevronDown } from '@/components/Icons';
import Mapsection from '@/components/MapSection';
import SearchPOI from '@/components/SearchPOI';
import { haversineDistance } from '@/data/pois';
import { useApp } from '@/store/AppContext';
import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import LanguageModal from './components/LanguageModal';
import NearbyPOI from './components/NearbyPOI';
import PreviewPOI from './components/PreviewPOI';

export default function HomeScreen() {
  const {
    pois,
    supportedLanguages,
    language,
    setLanguage,
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
  const [langModalVisible, setLangModalVisible] = useState(false);

  const currentLang = useMemo(() => {
    return (
      supportedLanguages.find((l) => l.code === language) || {
        code: language,
        flag: '🌐',
        name: language.toUpperCase(),
      }
    );
  }, [supportedLanguages, language]);

  const nearbyPOIs = useMemo(() => {
    return pois.filter(
      (p) => haversineDistance(userLat, userLng, p.lat, p.lng) <= activationRadius
    );
  }, [userLat, userLng, activationRadius, pois]);

  const selectedPOI = useMemo(() => {
    if (!selectedMapPOIId) return null;
    return pois.find((p) => p.id === selectedMapPOIId) || null;
  }, [selectedMapPOIId, pois]);

  const searchResults = useMemo(() => {
    if (!homeSearch.trim()) return [];
    const query = homeSearch.toLowerCase().trim();
    return pois.filter((p) => {
      let name = '';
      if (typeof p.name === 'object' && p.name !== null) {
        name = p.name[language] || p.name.vi || '';
      } else if (typeof p.name === 'string') {
        name = p.name;
      }
      const address = p.address || '';
      return name.toLowerCase().includes(query) || address.toLowerCase().includes(query);
    });
  }, [homeSearch, language, pois]);

  return (
    <View className="flex-1 bg-white">
      {/* HEADER */}
      <View className="z-10 flex-row items-center justify-between bg-white px-4 pb-2.5 pt-3 shadow-sm">
        <Text className="text-2xl font-extrabold tracking-tight text-teal-600">VietGuide</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setLangModalVisible(true)}
          className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5"
        >
          <Text>{currentLang.flag}</Text>
          <Text className="text-xs font-semibold uppercase text-gray-700">{language}</Text>
          <IconChevronDown size={12} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <LanguageModal
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
        supportedLanguages={supportedLanguages}
        currentLanguage={language}
        onSelectLanguage={(code) => setLanguage(code as any)}
      />

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

        {!selectedPOI && (
          <NearbyPOI
            nearbyPOIs={nearbyPOIs}
            language={language}
            userLat={userLat}
            userLng={userLng}
            onSelectPOI={(id) => setSelectedMapPOIId(id)}
          />
        )}

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
