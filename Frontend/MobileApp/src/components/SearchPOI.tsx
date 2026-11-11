import { IconClose, IconSearch } from '@/components/Icons';
import { formatDistance, haversineDistance, POI } from '@/data/pois';
import React from 'react';
import {
  Image,
  Keyboard, // Import Keyboard từ react-native
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface SearchPOIProps {
  homeSearch: string;
  setHomeSearch: (text: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  searchResults: POI[];
  language: string;
  userLat: number;
  userLng: number;
  onSelectPOI: (poiId: string) => void;
}

export default function SearchPOI({
  homeSearch,
  setHomeSearch,
  searchOpen,
  setSearchOpen,
  searchResults,
  language,
  userLat,
  userLng,
  onSelectPOI,
}: SearchPOIProps) {
  const handleCloseSearch = () => {
    Keyboard.dismiss();
    setSearchOpen(false);
  };

  return (
    <View className="z-20 bg-white px-4 pb-3">
      {/* KHU VỰC Ô TÌM KIẾM */}
      <View className="relative z-30 flex-row items-center rounded-xl bg-gray-100 px-3 py-1">
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
          className="flex-1 px-2 py-2 text-sm text-gray-800"
        />

        {homeSearch.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setHomeSearch('');
              handleCloseSearch();
            }}
            className="p-1"
          >
            <IconClose size={14} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* LỚP PHỦ BẤM RA NGOÀI */}
      {searchOpen && (
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: -100,
            right: -100,
            bottom: -2000,
            zIndex: 20,
          }}
          onPress={handleCloseSearch}
        />
      )}

      {/* POPUP KẾT QUẢ TÌM KIẾM */}
      {searchOpen && searchResults.length > 0 && (
        <View className="absolute left-4 right-4 top-14 z-30 max-h-60 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl">
          <ScrollView keyboardShouldPersistTaps="handled">
            {searchResults.map((p) => {
              const poiName =
                typeof p.name === 'object'
                  ? p.name[language as keyof typeof p.name] || p.name.vi
                  : p.name;
              const distanceStr = formatDistance(haversineDistance(userLat, userLng, p.lat, p.lng));

              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelectPOI(p.id);
                    setHomeSearch('');
                    handleCloseSearch();
                  }}
                  className="flex-row items-center gap-3 border-b border-gray-50 px-3 py-2.5 active:bg-gray-50"
                >
                  <Image
                    source={{ uri: p.coverImage }}
                    className="h-8 w-8 rounded-lg bg-gray-200"
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-800" numberOfLines={1}>
                      {poiName}
                    </Text>
                    {p.address && (
                      <Text className="text-xs text-gray-400" numberOfLines={1}>
                        {p.address}
                      </Text>
                    )}
                  </View>
                  <Text className="text-[10px] text-gray-400">{distanceStr}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* THÔNG BÁO KHÔNG TÌM THẤY */}
      {searchOpen && homeSearch.length > 0 && searchResults.length === 0 && (
        <View className="absolute left-4 right-4 top-14 z-30 items-center rounded-xl border border-gray-100 bg-white p-4 shadow-xl">
          <Text className="text-sm text-gray-500">Không tìm thấy địa điểm nào</Text>
        </View>
      )}
    </View>
  );
}
