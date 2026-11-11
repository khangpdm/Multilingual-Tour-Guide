import { IconMapPin } from '@/components/Icons';
import { formatDistance, haversineDistance, POI } from '@/data/pois';
import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface NearbyPOIProps {
  nearbyPOIs: POI[];
  language: string;
  userLat: number;
  userLng: number;
  onSelectPOI: (poiId: string) => void;
}

export default function NearbyPOI({
  nearbyPOIs,
  language,
  userLat,
  userLng,
  onSelectPOI,
}: NearbyPOIProps) {
  if (nearbyPOIs.length === 0) return null;

  return (
    <View className="absolute bottom-2 left-2 right-2">
      <View className="flex-row items-center gap-2 rounded-t-xl bg-orange-500 px-3 py-1.5">
        <IconMapPin size={12} color="#FFFFFF" />
        <Text className="text-xs font-semibold text-white">
          Ở gần bạn • {nearbyPOIs.length} địa điểm
        </Text>
      </View>

      <View className="rounded-b-xl bg-white/95 p-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          className="flex-row"
        >
          {nearbyPOIs.map((p) => {
            const poiName =
              typeof p.name === 'object'
                ? p.name[language as keyof typeof p.name] || p.name.vi
                : p.name;
            const distanceStr = formatDistance(haversineDistance(userLat, userLng, p.lat, p.lng));

            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.8}
                onPress={() => onSelectPOI(p.id)}
                className="flex-row items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-2 py-1.5 active:bg-orange-100"
              >
                <Image
                  source={{ uri: p.coverImage }}
                  className="h-10 w-10 rounded-lg bg-gray-200"
                />
                <View>
                  <Text
                    className="max-w-[100px] text-[10px] font-semibold text-gray-800"
                    numberOfLines={1}
                  >
                    {poiName}
                  </Text>
                  <Text className="text-[9px] font-medium text-orange-600">{distanceStr}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
