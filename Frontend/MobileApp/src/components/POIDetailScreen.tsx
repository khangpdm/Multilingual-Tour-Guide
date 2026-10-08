import { useState } from 'react';
import { Alert, Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_COLORS, formatDistance, haversineDistance, POIS } from '@/data/pois';
import { useApp } from '@/store/AppContext';

import {
  IconBack,
  IconDownload,
  IconMapPin,
  IconNavigation,
  IconPause,
  IconPlay,
  IconVolume,
} from './Icons';

const LANGUAGES = ['vi', 'en', 'fr', 'ja', 'ko', 'zh'] as const;
const SPEECH_RATES = [0.75, 1, 1.25, 1.5];

interface Props {
  poiId: string;
  onBack: () => void;
}

export default function POIDetailScreen({ poiId, onBack }: Props) {
  const insets = useSafeAreaInsets();

  const {
    language,
    userLat,
    userLng,
    startPlayback,
    togglePlayback,
    playingPOIId,
    isPlaying,
    playerProgress,
    speechRate,
    setSpeechRate,
    downloads,
    setActiveTab,
  } = useApp();

  const [expanded, setExpanded] = useState(false);

  const poi = POIS.find((item) => item.id === poiId);

  const safeTop = Math.max(insets.top, 16) + 8;

  if (!poi) {
    return (
      <View
        className="absolute inset-0 z-50 flex-1 items-center justify-center bg-white px-4"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-gray-700">Không tìm thấy địa điểm: {poiId}</Text>

        <TouchableOpacity onPress={onBack} className="mt-4 p-3">
          <Text className="text-teal-600">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = poi.name[language] || poi.name.vi || 'Địa điểm';
  const description = poi.description[language];
  const script = poi.ttsScript[language];

  const categoryColor = CATEGORY_COLORS[poi.category] || '#0D9488';

  const isCurrentPOI = playingPOIId === poi.id;
  const isCurrentPOIPlaying = isCurrentPOI && isPlaying;

  const progress =
    isCurrentPOI && Number.isFinite(playerProgress)
      ? Math.max(0, Math.min(100, playerProgress))
      : 0;

  const distance = haversineDistance(userLat, userLng, poi.lat, poi.lng);

  const availableLanguages = LANGUAGES.filter((item) => poi.ttsScript[item]);

  const downloadStatus = downloads[`q1-${language}`];

  const downloadLabel =
    downloadStatus === 'done'
      ? 'Đã tải'
      : downloadStatus === 'downloading'
        ? 'Đang tải'
        : 'Tải offline';

  const openMap = async () => {
    if (!poi.mapLink) {
      Alert.alert('Bản đồ', 'Địa điểm này chưa có liên kết bản đồ.');
      return;
    }

    try {
      await Linking.openURL(poi.mapLink);
    } catch {
      Alert.alert('Bản đồ', 'Không thể mở liên kết bản đồ. Bạn hãy thử lại.');
    }
  };

  const handlePlayback = () => {
    if (isCurrentPOI) {
      void togglePlayback();
    } else {
      void startPlayback(poi.id);
    }
  };

  const openDownloads = () => {
    setActiveTab('download');
    onBack();
  };

  return (
    <View className="absolute inset-0 z-50 flex-col overflow-hidden bg-slate-50">
      <View className="relative h-72 shrink-0 bg-gray-200">
        <Image
          source={{ uri: poi.coverImage }}
          accessibilityLabel={name}
          resizeMode="cover"
          className="h-full w-full"
        />

        <View className="absolute inset-0 bg-black/30" />

        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          activeOpacity={0.7}
          className="absolute left-4 h-10 w-10 items-center justify-center rounded-full bg-black/50"
          style={{ top: safeTop }}
        >
          <IconBack size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View
          className="absolute right-4 rounded-full px-3 py-1.5"
          style={{ backgroundColor: categoryColor, top: safeTop }}
        >
          <Text className="text-xs font-semibold text-white">{poi.category}</Text>
        </View>

        {/* Tên và địa chỉ */}
        <View className="absolute bottom-4 left-4 right-4">
          <Text numberOfLines={2} className="text-xl font-bold leading-7 text-white">
            {name}
          </Text>

          <View className="mt-1 flex-row items-center gap-1">
            <IconMapPin size={13} color="#FB923C" />

            <Text numberOfLines={2} className="flex-1 text-xs text-white/90">
              {poi.address}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 16 }}
      >
        <View className="border-b border-gray-100 bg-white px-4 py-3">
          <Text className="text-sm font-semibold text-orange-500">
            {formatDistance(distance)} từ bạn
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={openMap}
              activeOpacity={0.7}
              className="flex-row items-center gap-2 rounded-full border border-gray-200 px-3 py-2"
            >
              <IconNavigation size={14} color="#4B5563" />

              <Text className="text-xs text-gray-600">Mở bản đồ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openDownloads}
              activeOpacity={0.7}
              className={`flex-row items-center gap-2 rounded-full border px-3 py-2 ${
                downloadStatus === 'done'
                  ? 'border-teal-200 bg-teal-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <IconDownload size={14} color={downloadStatus === 'done' ? '#0F766E' : '#4B5563'} />

              <Text
                className={`text-xs font-medium ${
                  downloadStatus === 'done' ? 'text-teal-700' : 'text-gray-600'
                }`}
              >
                {downloadLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trình phát thuyết minh */}
        <View className="mx-4 mt-4 overflow-hidden rounded-2xl border border-gray-100">
          <View className="bg-teal-700 p-4">
            <View className="mb-4 flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  Thuyết minh âm thanh
                </Text>

                <Text className="mt-1 text-sm font-semibold text-white">{name}</Text>
              </View>

              <View className="h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <IconVolume size={18} color="#FFFFFF" />
              </View>
            </View>

            {script ? (
              <>
                {/* Thanh tiến trình */}
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: progress,
                  }}
                  className="h-1.5 overflow-hidden rounded-full bg-white/30"
                >
                  <View
                    className="h-full rounded-full bg-white"
                    style={{ width: `${progress}%` }}
                  />
                </View>

                <View className="mb-4 mt-2 flex-row justify-between">
                  <Text className="text-[10px] text-white/70">{Math.round(progress)}%</Text>

                  <Text className="text-[10px] text-white/70">Tiến trình thuyết minh</Text>
                </View>

                {/* Tốc độ và nút phát */}
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1 flex-row flex-wrap gap-1">
                    {SPEECH_RATES.map((rate) => {
                      const selected = speechRate === rate;

                      return (
                        <TouchableOpacity
                          key={rate}
                          onPress={() => setSpeechRate(rate)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Tốc độ ${rate} lần`}
                          accessibilityState={{ selected }}
                          className={`rounded px-2 py-2 ${selected ? 'bg-white' : 'bg-white/20'}`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              selected ? 'text-teal-700' : 'text-white'
                            }`}
                          >
                            {rate}×
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={handlePlayback}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isCurrentPOIPlaying ? 'Tạm dừng thuyết minh' : 'Phát thuyết minh'
                    }
                    className="h-12 w-12 items-center justify-center rounded-full bg-white"
                  >
                    {isCurrentPOIPlaying ? (
                      <IconPause size={20} color="#0F766E" />
                    ) : (
                      <IconPlay size={20} color="#0F766E" />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View className="rounded-xl bg-white/10 p-3">
                <Text className="text-center text-xs text-white/90">
                  Chưa có thuyết minh bằng ngôn ngữ này.
                </Text>

                {availableLanguages.length > 0 && (
                  <>
                    <Text className="mt-2 text-center text-[10px] text-white/70">
                      Ngôn ngữ có sẵn
                    </Text>

                    <View className="mt-2 flex-row flex-wrap justify-center gap-2">
                      {availableLanguages.map((item) => (
                        <View key={item} className="rounded bg-white/20 px-2 py-1">
                          <Text className="text-xs uppercase text-white">{item}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          <View className="bg-teal-50 px-4 py-2">
            <Text className="text-center text-[10px] text-teal-600">
              Thuyết minh TTS • Điều chỉnh giọng đọc trong Cài đặt
            </Text>
          </View>
        </View>

        {/* Giới thiệu */}
        <View className="mt-5 px-4">
          <Text className="mb-2 text-base font-bold text-gray-800">Giới thiệu</Text>

          {description ? (
            <>
              <Text
                numberOfLines={expanded ? undefined : 4}
                className="text-sm leading-6 text-gray-600"
              >
                {description}
              </Text>

              <TouchableOpacity
                onPress={() => setExpanded((value) => !value)}
                activeOpacity={0.7}
                className="mt-2 self-start py-2"
              >
                <Text className="text-sm font-semibold text-teal-600">
                  {expanded ? 'Thu gọn ↑' : 'Xem thêm ↓'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Text className="text-sm text-amber-700">Chưa có mô tả bằng ngôn ngữ này.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
