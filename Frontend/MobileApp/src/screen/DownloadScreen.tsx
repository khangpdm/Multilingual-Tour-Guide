import {
  IconCheck,
  IconClose,
  IconDownload,
  IconFlash,
  IconTrash,
  IconWifi,
} from '@/components/Icons';
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type DownloadStatus = 'complete' | 'downloading' | 'available';

type Tour = {
  id: string;
  image: string;
  language: string;
  languageName: string;
  title: string;
  places: number;
  size: string;
  status: DownloadStatus;
  progress?: number;
};

const INITIAL_TOURS: Tour[] = [
  {
    id: 'quan-1',
    image:
      'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=900&q=80',
    language: 'VN',
    languageName: 'Tiếng Việt',
    title: 'Quận 1 – Trung tâm lịch sử',
    places: 8,
    size: '45 MB',
    status: 'complete',
  },
  {
    id: 'district-1-en',
    image:
      'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=900&q=80',
    language: 'US',
    languageName: 'English',
    title: 'District 1 – Historic Center',
    places: 8,
    size: '48 MB',
    status: 'downloading',
    progress: 0.62,
  },
  {
    id: 'district-1-fr',
    image:
      'https://images.unsplash.com/photo-1562602833-0f4ab2fc46e3?auto=format&fit=crop&w=900&q=80',
    language: 'FR',
    languageName: 'Français',
    title: 'District 1 – Centre historique',
    places: 8,
    size: '43 MB',
    status: 'available',
  },
];

const statusLabel: Record<DownloadStatus, string> = {
  complete: 'Đã tải xong',
  downloading: 'Đang tải',
  available: 'Tải xuống',
};

function TourCard({ tour, onDelete, onCancel, onDownload }: {
  tour: Tour;
  onDelete: () => void;
  onCancel: () => void;
  onDownload: () => void;
}) {
  const isComplete = tour.status === 'complete';
  const isDownloading = tour.status === 'downloading';

  return (
    <View style={styles.card}>
      <View style={styles.coverWrap}>
        <Image source={{ uri: tour.image }} style={styles.cover} />
        <View style={styles.coverShade} />
        <View style={styles.languageRow}>
          <Text style={styles.languageCode}>{tour.language}</Text>
          <Text style={styles.languageName}>{tour.languageName}</Text>
        </View>
        {isComplete ? (
          <View style={styles.completeBadge}>
            <IconCheck size={14} color="#ffffff" />
          </View>
        ) : null}
        {isDownloading ? (
          <View style={styles.downloadingBadge}>
            <Text style={styles.downloadingText}>Đang tải</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.tourTitle}>{tour.title}</Text>
        <Text style={styles.tourMeta}>{tour.places} địa điểm <Text style={styles.dot}>·</Text> {tour.size}</Text>

        {isDownloading ? (
          <View style={styles.progressArea}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${(tour.progress ?? 0) * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>62% · 18.2 MB còn lại</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={isComplete ? onDelete : isDownloading ? onCancel : onDownload}
            style={({ pressed }) => [
              styles.actionButton,
              isComplete ? styles.completeAction : isDownloading ? styles.cancelAction : styles.downloadAction,
              pressed && styles.pressed,
            ]}
          >
            {isComplete ? <IconCheck size={13} color="#008f83" /> : null}
            {isDownloading ? <IconClose size={13} color="#52606d" /> : null}
            {!isComplete && !isDownloading ? <IconDownload size={14} color="#ffffff" /> : null}
            <Text style={isComplete ? styles.completeActionText : isDownloading ? styles.cancelActionText : styles.downloadActionText}>
              {isComplete ? statusLabel.complete : isDownloading ? 'Hủy' : statusLabel.available}
            </Text>
          </Pressable>
          {isComplete ? (
            <Pressable
              accessibilityLabel="Xóa bản tải xuống"
              accessibilityRole="button"
              onPress={onDelete}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
            >
              <IconTrash size={16} color="#ff6b6b" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function DownloadScreen() {
  const [tours, setTours] = useState(INITIAL_TOURS);
  const downloadedSize = tours.filter((tour) => tour.status === 'complete').length ? '45 MB' : '0 MB';

  const updateTour = (id: string, status: DownloadStatus) => {
    setTours((current) => current.map((tour) => (tour.id === id ? { ...tour, status } : tour)));
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Nội dung offline</Text>

        <View style={styles.storageCard}>
          <View style={styles.storageIcon}>
            <IconDownload size={20} color="#00a99a" />
          </View>
          <View style={styles.storageCopy}>
            <Text style={styles.storageTitle}>{downloadedSize} đã tải</Text>
            <Text style={styles.storageSubtitle}>1 gói / 6 gói khả dụng</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.wifiButton, pressed && styles.pressed]}>
            <IconWifi size={14} color="#ffffff" />
            <Text style={styles.wifiText}>Wi-Fi</Text>
          </Pressable>
        </View>

        <View style={styles.networkHint}>
          <IconFlash size={11} color="#ff8a52" />
          <Text style={styles.networkHintText}>Chỉ tải khi kết nối Wi-Fi</Text>
        </View>

        <Text style={styles.sectionLabel}>TP. HỒ CHÍ MINH · QUẬN 1</Text>
        {tours.map((tour) => (
          <TourCard
            key={tour.id}
            tour={tour}
            onDelete={() => setTours((current) => current.filter((item) => item.id !== tour.id))}
            onCancel={() => updateTour(tour.id, 'available')}
            onDownload={() => updateTour(tour.id, 'downloading')}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafb' },
  content: { paddingHorizontal: 16, paddingTop: 17, paddingBottom: 20 },
  pageTitle: { color: '#102338', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  storageCard: {
    alignItems: 'center',
    backgroundColor: '#effcf9',
    borderRadius: 12,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 12,
  },
  storageIcon: { alignItems: 'center', backgroundColor: '#d2f8f1', borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  storageCopy: { flex: 1, marginLeft: 10 },
  storageTitle: { color: '#008f83', fontSize: 12, fontWeight: '800' },
  storageSubtitle: { color: '#3d9d96', fontSize: 9, marginTop: 2 },
  wifiButton: { alignItems: 'center', backgroundColor: '#08ae9f', borderRadius: 16, flexDirection: 'row', gap: 5, paddingHorizontal: 12, paddingVertical: 8 },
  wifiText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  networkHint: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingVertical: 9 },
  networkHintText: { color: '#7e8a94', fontSize: 8, marginLeft: 4 },
  sectionLabel: { color: '#8b99a7', fontSize: 10, fontWeight: '700', letterSpacing: 0.2, marginBottom: 9, marginTop: 1 },
  card: { backgroundColor: '#ffffff', borderColor: '#e5eaed', borderRadius: 12, borderWidth: 1, elevation: 2, marginBottom: 9, overflow: 'hidden', shadowColor: '#61707c', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.1, shadowRadius: 5 },
  coverWrap: { height: 82, position: 'relative' },
  cover: { height: '100%', width: '100%' },
  coverShade: { backgroundColor: 'rgba(17, 34, 43, 0.34)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  languageRow: { alignItems: 'center', bottom: 9, flexDirection: 'row', left: 9, position: 'absolute' },
  languageCode: { color: '#111c22', fontSize: 9, fontWeight: '800', marginRight: 4 },
  languageName: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  completeBadge: { alignItems: 'center', backgroundColor: '#00af9d', borderRadius: 12, height: 20, justifyContent: 'center', position: 'absolute', right: 7, top: 7, width: 20 },
  downloadingBadge: { backgroundColor: '#2787e8', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, position: 'absolute', right: 7, top: 7 },
  downloadingText: { color: '#ffffff', fontSize: 8, fontWeight: '800' },
  cardBody: { paddingHorizontal: 9, paddingVertical: 8 },
  tourTitle: { color: '#13283a', fontSize: 11, fontWeight: '800' },
  tourMeta: { color: '#687b89', fontSize: 9, marginTop: 4 },
  dot: { color: '#a9b4bb' },
  progressArea: { marginTop: 8 },
  progressTrack: { backgroundColor: '#edf0f2', borderRadius: 4, height: 4, overflow: 'hidden' },
  progressBar: { backgroundColor: '#00b3a4', borderRadius: 4, height: 4 },
  progressLabel: { color: '#00a99a', fontSize: 8, marginTop: 4 },
  actionRow: { alignItems: 'center', flexDirection: 'row', marginTop: 8 },
  actionButton: { alignItems: 'center', borderRadius: 10, flex: 1, flexDirection: 'row', gap: 4, height: 25, justifyContent: 'center' },
  completeAction: { backgroundColor: '#edfbf8' },
  cancelAction: { backgroundColor: '#f1f3f5' },
  downloadAction: { backgroundColor: '#06aa9c' },
  completeActionText: { color: '#008f83', fontSize: 9, fontWeight: '700' },
  cancelActionText: { color: '#52606d', fontSize: 9, fontWeight: '700' },
  downloadActionText: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
  deleteButton: { alignItems: 'center', backgroundColor: '#fff2f2', borderRadius: 10, height: 25, justifyContent: 'center', marginLeft: 6, width: 30 },
  pressed: { opacity: 0.72 },
});