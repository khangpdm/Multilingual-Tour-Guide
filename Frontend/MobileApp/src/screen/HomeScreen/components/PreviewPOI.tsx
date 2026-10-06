import { IconClose, IconPlay } from '@/components/Icons';
import { CATEGORY_COLORS, formatDistance, haversineDistance, POI } from '@/data/pois';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

interface PreviewPOIProps {
  selectedPOI: POI;
  language: string;
  userLat: number;
  userLng: number;
  onClose: () => void;
  onStartPlayback: (poiId: string) => void;
  onOpenPOI: (poiId: string) => void;
}

export default function PreviewPOI({
  selectedPOI,
  language,
  userLat,
  userLng,
  onClose,
  onStartPlayback,
  onOpenPOI,
}: PreviewPOIProps) {
  const poiName =
    typeof selectedPOI.name === 'object'
      ? selectedPOI.name[language as keyof typeof selectedPOI.name] || selectedPOI.name.vi
      : selectedPOI.name;

  const distanceStr = formatDistance(
    haversineDistance(userLat, userLng, selectedPOI.lat, selectedPOI.lng)
  );

  return (
    <View className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-gray-100 bg-white shadow-2xl">
      <View className="items-center pb-1 pt-2.5">
        <View className="h-1 w-10 rounded-full bg-gray-300" />
      </View>

      <View className="flex-row gap-3 px-4 pb-4">
        <Image
          source={{ uri: selectedPOI.coverImage }}
          className="h-16 w-16 rounded-xl bg-gray-100"
        />

        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-bold text-gray-800" numberOfLines={1}>
                {poiName}
              </Text>
              <View
                className="mt-1 self-start rounded-full px-2 py-0.5"
                style={{
                  backgroundColor: CATEGORY_COLORS[selectedPOI.category] || '#0D9488',
                }}
              >
                <Text className="text-[10px] font-semibold text-white">{selectedPOI.category}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} className="p-1">
              <IconClose size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text className="mt-1 text-xs font-medium text-orange-500">{distanceStr} từ bạn</Text>
        </View>
      </View>

      <View className="flex-row gap-2 px-4 pb-4">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onStartPlayback(selectedPOI.id)}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 active:bg-teal-700"
        >
          <IconPlay size={14} color="#FFFFFF" />
          <Text className="text-sm font-semibold text-white">Nghe thuyết minh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            onOpenPOI(selectedPOI.id);
            onClose();
          }}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border-2 border-teal-600 py-2.5 active:bg-teal-50"
        >
          <Text className="text-sm font-semibold text-teal-600">Xem chi tiết</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
