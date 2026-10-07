import { IconCheck, IconClose, IconSearch } from '@/components/Icons';
import {
  CATEGORY_COLORS,
  POIS,
  formatDistance,
  haversineDistance,
  type Category,
  type POI,
} from '@/data/pois';
import { useApp } from '@/store/AppContext';
import React, { useMemo } from 'react';
import { FlatList, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const CATEGORIES = [
  'Tất cả',
  'Di tích',
  'Bảo tàng',
  'Tôn giáo',
  'Kiến trúc',
  'Công viên',
  'Ẩm thực',
];

export default function ExploreScreen() {
  const {
    exploreSearch,
    setExploreSearch,
    exploreCategory,
    setExploreCategory,
    exploreSort,
    setExploreSort,
    language,
    openPOI,
    userLat,
    userLng,
    downloads,
  } = useApp();

  const filteredPOIs = useMemo(() => {
    const q = exploreSearch.trim().toLowerCase();

    const list = POIS.filter((p) => {
      const matchCat = exploreCategory === 'Tất cả' || p.category === exploreCategory;
      const nameMatch = p.name[language]?.toLowerCase().includes(q);
      const addressMatch = p.address?.toLowerCase().includes(q);
      const matchQ = !q || nameMatch || addressMatch;
      return matchCat && matchQ;
    });

    return [...list].sort((a, b) => {
      if (exploreSort === 'distance') {
        return (
          haversineDistance(userLat, userLng, a.lat, a.lng) -
          haversineDistance(userLat, userLng, b.lat, b.lng)
        );
      }
      return (a.name[language] ?? '').localeCompare(b.name[language] ?? '');
    });
  }, [exploreCategory, exploreSearch, exploreSort, language, userLat, userLng]);

  const isDownloaded = (poiId: string) => {
    const pkg = `q1-${language}`;
    return downloads[pkg] === 'done';
  };

  const renderItem = ({ item: poi }: { item: POI }) => {
    const dist = haversineDistance(userLat, userLng, poi.lat, poi.lng);
    const downloaded = isDownloaded(poi.id);

    return (
      <TouchableOpacity
        onPress={() => openPOI(poi.id)}
        activeOpacity={0.8}
        className="w-full flex-row items-start gap-3 p-3 mb-3 bg-white rounded-2xl border border-gray-200"
      >
        <View className="w-24 h-28 flex-none overflow-hidden rounded-xl bg-gray-100 relative">
          <Image source={{ uri: poi.coverImage }} className="w-full h-full" resizeMode="cover" />
          {downloaded && (
            <View className="absolute top-1.5 right-1.5 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
              <IconCheck size={11} color="#ffffff" />
            </View>
          )}
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row flex-wrap items-center justify-between gap-1.5">
            <View
              className="px-2 py-1 rounded-md"
              style={{ backgroundColor: CATEGORY_COLORS[poi.category] }}
            >
              <Text className="text-xs leading-4 font-semibold text-white">{poi.category}</Text>
            </View>
            <Text className="text-xs leading-4 text-gray-500 font-medium flex-none">
              {formatDistance(dist)}
            </Text>
          </View>
          <Text className="text-base leading-[22px] font-bold text-gray-800 mt-2" numberOfLines={2}>
            {poi.name[language] ?? ''}
          </Text>
          {poi.shortDesc?.[language] && (
            <Text className="text-sm leading-5 text-gray-500 mt-1" numberOfLines={2}>
              {poi.shortDesc[language]}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 overflow-hidden bg-gray-50">
      {/* Header */}
      <View className="flex-none bg-white px-4 pt-4 border-b border-gray-100">
        <View className="flex-row flex-wrap items-center justify-between gap-3 mb-4">
          <Text className="text-[28px] leading-9 font-bold text-gray-800">Khám phá</Text>
          <View className="flex-row items-center gap-1 rounded-xl bg-gray-100 p-1">
            {(['distance', 'name'] as const).map((s) => {
              const selected = exploreSort === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setExploreSort(s)}
                  activeOpacity={0.7}
                  className={`rounded-lg px-3 py-2 ${selected ? 'bg-white' : 'bg-transparent'}`}
                >
                  <Text
                    className={`text-sm leading-5 font-semibold ${
                      selected ? 'text-teal-600' : 'text-gray-500'
                    }`}
                  >
                    {s === 'distance' ? 'Gần nhất' : 'A–Z'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Search */}
        <View className="mb-3 flex-row items-center gap-2.5 bg-gray-100 rounded-xl px-3.5 h-12">
          <IconSearch size={20} color="#9ca3af" />
          <TextInput
            value={exploreSearch}
            onChangeText={setExploreSearch}
            placeholder="Tìm địa điểm…"
            placeholderTextColor="#9ca3af"
            className="flex-1 text-base text-gray-700 py-0 m-0"
          />
          {exploreSearch ? (
            <TouchableOpacity onPress={() => setExploreSearch('')} className="p-2">
              <IconClose size={16} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
        >
          {CATEGORIES.map((cat) => {
            const active = exploreCategory === cat;
            const color = cat !== 'Tất cả' ? CATEGORY_COLORS[cat as Category] : '#0d9488';
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setExploreCategory(cat)}
                className="px-4 py-2 rounded-full"
                style={{
                  backgroundColor: active ? color : '#f3f4f6',
                }}
              >
                <Text
                  className={`text-[15px] leading-5 font-semibold ${
                    active ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredPOIs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <View className="flex flex-col items-center justify-center px-4 py-16">
            <Text className="text-4xl mb-3">🔍</Text>
            <Text className="text-base text-center text-gray-700 font-semibold">
              Không tìm thấy địa điểm nào
            </Text>
            <Text className="text-gray-500 text-sm leading-5 text-center mt-2">
              Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
            </Text>
            <TouchableOpacity
              onPress={() => {
                setExploreSearch('');
                setExploreCategory('Tất cả');
              }}
              className="mt-5 px-5 py-3 bg-teal-50 rounded-full"
            >
              <Text className="text-teal-600 text-sm font-semibold">Xóa bộ lọc</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
