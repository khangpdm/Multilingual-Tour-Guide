import {
  IconCheck,
  IconClose,
  IconDownload,
  IconFlash,
  IconTrash,
  IconWifi,
} from '@/components/Icons';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

type DownloadStatus = 'downloaded' | 'downloading' | 'available';

interface Region {
  id: string;
  city: string;
  title: string;
  language: string;
  languageName: string;
  points: number;
  size: string;
  image: string;
  status: DownloadStatus;
  progress?: number;
}

const INITIAL_REGIONS: Region[] = [
  {
    id: 'history',
    city: 'QUẬN 1',
    title: 'Quận 1 - Trung tâm lịch sử',
    language: 'VN',
    languageName: 'Tiếng Việt',
    points: 8,
    size: '45 MB',
    image:
      'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=900&q=80',
    status: 'downloaded',
  },
  {
    id: 'district-1',
    city: 'QUẬN 1',
    title: 'District 1 - Historic Center',
    language: 'US',
    languageName: 'English',
    points: 8,
    size: '48 MB',
    image:
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=900&q=80',
    status: 'downloading',
    progress: 62,
  },
  {
    id: 'centre',
    city: 'QUẬN 1',
    title: 'District 1 - Centre historique',
    language: 'FR',
    languageName: 'Français',
    points: 8,
    size: '46 MB',
    image:
      'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=900&q=80',
    status: 'available',
  },
];

function RegionCard({ region, onAction }: { region: Region; onAction: () => void }) {
  const progress = region.progress ?? 0;
  const statusLabel =
    region.status === 'downloaded'
      ? 'Đã tải xong'
      : region.status === 'downloading'
        ? 'Hủy'
        : 'Tải xuống';

  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Phần Hình ảnh Header */}
      <View className="relative h-32 overflow-hidden">
        <Image
          source={{ uri: region.image }}
          className="absolute inset-0 h-full w-full"
          resizeMode="cover"
        />
        <View className="absolute inset-0 bg-black/30" />

        {region.status === 'downloading' && (
          <View className="absolute right-3 top-3 rounded-full bg-sky-500 px-2.5 py-1">
            <Text className="text-[11px] font-bold text-white">Đang tải</Text>
          </View>
        )}
        {region.status === 'downloaded' && (
          <View className="absolute right-3 top-3 h-7 w-7 items-center justify-center rounded-full bg-teal-500">
            <IconCheck size={16} color="#FFFFFF" />
          </View>
        )}

        <View className="absolute bottom-3 left-3 flex-row items-center">
          <Text className="mr-1.5 text-[12px] font-medium text-white">{region.language}</Text>
          <Text className="text-[13px] font-bold text-white">{region.languageName}</Text>
        </View>
      </View>

      {/* Phần Nội dung */}
      <View className="p-4">
        <Text className="text-[15px] font-bold text-slate-800">{region.title}</Text>

        <View className="mt-1.5 flex-row items-center">
          <Text className="text-[12px] text-slate-500">{region.points} địa điểm</Text>
          <Text className="mx-2 text-[12px] text-slate-300">•</Text>
          <Text className="text-[12px] text-slate-500">{region.size}</Text>
        </View>

        {region.status === 'downloading' && (
          <>
            <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <View className="h-full rounded-full bg-teal-500" style={{ width: `${progress}%` }} />
            </View>
            <Text className="mt-1.5 text-[11px] text-teal-600 font-medium">
              {progress}% · 18.2 MB còn lại
            </Text>
          </>
        )}

        {/* Nút hành động chính */}
        <Pressable
          onPress={onAction}
          className={`mt-3.5 h-10 flex-row items-center justify-center rounded-xl ${
            region.status === 'downloaded'
              ? 'bg-teal-50'
              : region.status === 'downloading'
                ? 'bg-slate-100'
                : 'bg-teal-500'
          }`}
        >
          {region.status === 'downloaded' ? (
            <IconCheck size={15} color="#0f766e" />
          ) : region.status === 'downloading' ? (
            <IconClose size={14} color="#475569" />
          ) : (
            <IconDownload size={15} color="#FFFFFF" />
          )}
          <Text
            className={`ml-2 text-[13px] font-semibold ${
              region.status === 'available'
                ? 'text-white'
                : region.status === 'downloaded'
                  ? 'text-teal-700'
                  : 'text-slate-600'
            }`}
          >
            {statusLabel}
          </Text>
        </Pressable>

        {/* Nút xóa riêng khi đã tải xong */}
        {region.status === 'downloaded' && (
          <Pressable
            onPress={onAction}
            className="absolute bottom-4 right-4 h-10 w-10 items-center justify-center rounded-xl bg-red-50"
          >
            <IconTrash size={16} color="#ef4444" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function DownloadScreen() {
  const [regions, setRegions] = useState(INITIAL_REGIONS);

  const updateRegion = (id: string) => {
    setRegions((current) =>
      current.map((region) => {
        if (region.id !== id) return region;
        if (region.status === 'downloaded') return { ...region, status: 'available' };
        if (region.status === 'downloading') return { ...region, status: 'available', progress: 0 };
        return { ...region, status: 'downloading', progress: 18 };
      })
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        {/* Header Tổng quan */}
        <View className="bg-white px-4 pb-4 pt-3 border-b border-slate-100">
          <Text className="text-[20px] font-extrabold text-slate-900">Nội dung offline</Text>

          <View className="mt-3 flex-row items-center justify-between rounded-2xl bg-teal-50 px-4 py-3">
            <View className="flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
                <IconDownload size={20} color="#0d9488" />
              </View>
              <View>
                <Text className="text-[13px] font-bold text-teal-700">45 MB đã tải</Text>
                <Text className="mt-0.5 text-[11px] text-teal-600">1 gói / 6 gói khả dụng</Text>
              </View>
            </View>
            <Pressable className="flex-row items-center rounded-full bg-teal-500 px-4 py-2">
              <IconWifi size={14} color="#FFFFFF" />
              <Text className="ml-1.5 text-[12px] font-bold text-white">Wi-Fi</Text>
            </Pressable>
          </View>

          <View className="mt-2.5 flex-row items-center justify-center">
            <IconFlash size={12} color="#f97316" />
            <Text className="ml-1.5 text-[11px] text-slate-400">Chỉ tải khi kết nối Wi-Fi</Text>
          </View>
        </View>

        {/* Tiêu đề khu vực */}
        <View className="bg-slate-100 px-4 py-2.5">
          <Text className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
            TP. Hồ Chí Minh · Quận 1
          </Text>
        </View>

        {/* Danh sách các card */}
        <View className="px-4 pt-3">
          {regions.map((region) => (
            <RegionCard key={region.id} region={region} onAction={() => updateRegion(region.id)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
