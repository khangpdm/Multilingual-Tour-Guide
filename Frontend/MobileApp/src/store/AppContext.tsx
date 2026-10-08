import { DEMO_USER_LOCATIONS, LANG_TO_SPEECH, Language, POIS } from '@/data/pois';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

export type { Language };
export type Tab = 'home' | 'explore' | 'scan' | 'download' | 'settings';
export type DownloadStatus = 'none' | 'downloading' | 'done' | 'failed';
export type LocationMode = 'battery' | 'balanced' | 'accuracy';
export type VoiceId = 'an' | 'hoai-my' | 'nam-minh';
export type DemoLocation = 'near' | 'far';

interface AppContextValue {
  // Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  openPOI: (id: string) => void;
  closePOI: () => void;
  activePOIId: string | null;

  // Map
  userLat: number;
  userLng: number;
  setUserLocation: (lat: number, lng: number) => void;
  selectedMapPOIId: string | null;
  setSelectedMapPOIId: (id: string | null) => void;

  // Language
  language: Language;
  setLanguage: (language: Language) => void;
  langMenuOpen: boolean;
  setLangMenuOpen: (open: boolean) => void;
  autoPlay: boolean;
  setAutoPlay: (enabled: boolean) => void;
  triggerRadius: number;
  setTriggerRadius: (radius: number) => void;
  locationMode: LocationMode;
  setLocationMode: (mode: LocationMode) => void;
  wifiOnly: boolean;
  setWifiOnly: (enabled: boolean) => void;
  voice: VoiceId;
  setVoice: (voice: VoiceId) => void;

  // Geofence / Demo
  activationRadius: number;
  setActivationRadius: (r: number) => void;
  demoLocation: DemoLocation;
  setDemoLocation: (m: DemoLocation) => void;
  isDemoMode: boolean;
  setIsDemoMode: (v: boolean) => void;

  // Explore Screen
  exploreSearch: string;
  setExploreSearch: (q: string) => void;
  exploreCategory: string;
  setExploreCategory: (c: string) => void;
  exploreSort: 'distance' | 'name';
  setExploreSort: (s: 'distance' | 'name') => void;

  // Home Search
  homeSearch: string;
  setHomeSearch: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;

  // Download Screen
  downloads: Record<string, DownloadStatus>;

  // Audio Player
  startPlayback: (poiId: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  playingPOIId: string | null;
  isPlaying: boolean;
  playerProgress: number;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  showMiniPlayer: boolean;
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // Language
  const [language, setLanguage] = useState<Language>('vi');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [voice, setVoice] = useState<VoiceId>('hoai-my');

  // POI selection
  const [selectedMapPOIId, setSelectedMapPOIId] = useState<string | null>(null);
  const [activePOIId, setActivePOIId] = useState<string | null>(null);

  // Search & Filter
  const [homeSearch, setHomeSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [exploreSearch, setExploreSearch] = useState('');
  const [exploreCategory, setExploreCategory] = useState('Tất cả');
  const [exploreSort, setExploreSort] = useState<'distance' | 'name'>('distance');

  // Downloads
  const [downloads] = useState<Record<string, DownloadStatus>>({});

  // User location / Geofencing
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoLocation, setDemoLocationState] = useState<DemoLocation>('near');
  const [activationRadius, setActivationRadius] = useState(1000); // Mặc định 1000m
  const [triggerRadius, setTriggerRadius] = useState(100);
  const [locationMode, setLocationMode] = useState<LocationMode>('balanced');

  const initialLocation = DEMO_USER_LOCATIONS?.near || { lat: 10.7769, lng: 106.7009 };
  const [userLat, setUserLat] = useState<number>(initialLocation.lat);
  const [userLng, setUserLng] = useState<number>(initialLocation.lng);

  // Cập nhật vị trí GPS thực từ Mapbox UserLocation
  const setDemoLocation = (mode: DemoLocation) => {
    setDemoLocationState(mode);
    setIsDemoMode(true);

    if (DEMO_USER_LOCATIONS?.[mode]) {
      setUserLat(DEMO_USER_LOCATIONS[mode].lat);
      setUserLng(DEMO_USER_LOCATIONS[mode].lng);
    }
  };

  const setUserLocation = (lat: number, lng: number) => {
    if (!isDemoMode) {
      setUserLat(lat);
      setUserLng(lng);
    }
  };

  const openPOI = (id: string) => {
    setActivePOIId(id);
    router.push({
      pathname: '/poi/[id]',
      params: { id },
    });
  };

  const [showMiniPlayer, setShowMiniPlayer] = useState(false);

  const closePOI = () => {
    setActivePOIId(null);
    if (isPlaying || playingPOIId) {
      setShowMiniPlayer(true);
    }
  };

  const [selectedVoice, setSelectedVoice] = useState('');

  // Nội dung đang đọc.
  const speechTextRef = useRef('');
  const speechLanguageRef = useRef('vi-VN');

  // Vị trí từ đang đọc, dùng khi tiếp tục.
  const speechOffsetRef = useRef(0);
  const speechActiveRef = useRef(false);

  // Ngăn callback của bài cũ cập nhật trạng thái bài mới.
  const speechSessionRef = useRef(0);

  // Dừng âm thanh khi AppProvider bị unmount.
  useEffect(() => {
    return () => {
      speechSessionRef.current += 1;
      speechActiveRef.current = false;

      void Speech.stop().catch(() => {});
    };
  }, []);

  // Hàm nội bộ: phát từ vị trí đang lưu.
  const speakFromOffset = async () => {
    const session = ++speechSessionRef.current;

    const fullText = speechTextRef.current;
    const offset = speechOffsetRef.current;
    const remainingText = fullText.slice(offset);

    if (!remainingText.trim()) return;

    speechActiveRef.current = true;
    setIsPlaying(true);

    try {
      // Xóa bài đọc và hàng đợi trước đó.
      await Speech.stop();

      if (session !== speechSessionRef.current) return;

      let voiceIdentifier: string | undefined;

      if (selectedVoice) {
        const voices = await Speech.getAvailableVoicesAsync();

        if (session !== speechSessionRef.current) return;

        const foundVoice = voices.find(
          (item) => item.identifier === selectedVoice || item.name === selectedVoice
        );

        voiceIdentifier = foundVoice?.identifier;
      }

      Speech.speak(remainingText, {
        language: speechLanguageRef.current,
        rate: speechRate,
        pitch: 1,
        ...(voiceIdentifier ? { voice: voiceIdentifier } : {}),

        // Cập nhật tiến trình theo vị trí trong văn bản.
        onBoundary: (event: { charIndex: number }) => {
          if (session !== speechSessionRef.current) return;
          if (!Number.isFinite(event.charIndex)) return;

          const position = Math.min(fullText.length, offset + Math.max(0, event.charIndex));

          speechOffsetRef.current = position;

          setPlayerProgress(Math.min((position / fullText.length) * 100, 99));
        },

        onDone: () => {
          if (session !== speechSessionRef.current) return;

          speechOffsetRef.current = fullText.length;
          speechActiveRef.current = false;

          setPlayerProgress(100);
          setIsPlaying(false);
        },

        onStopped: () => {
          if (session !== speechSessionRef.current) return;

          speechActiveRef.current = false;
          setIsPlaying(false);
        },

        onError: (error) => {
          if (session !== speechSessionRef.current) return;

          speechActiveRef.current = false;
          setIsPlaying(false);

          console.warn('TTS error:', error);

          Alert.alert(
            'Không phát được thuyết minh',
            'Hãy kiểm tra ngôn ngữ và giọng đọc TTS trên thiết bị.'
          );
        },
      });
    } catch (error) {
      if (session !== speechSessionRef.current) return;

      speechActiveRef.current = false;
      setIsPlaying(false);

      console.warn('TTS error:', error);

      Alert.alert('Thuyết minh', 'Không thể khởi động giọng đọc. Bạn hãy thử lại.');
    }
  };

  // Phát thuyết minh của một địa điểm.
  const startPlayback = async (poiId: string) => {
    const poi = POIS.find((item) => item.id === poiId);
    if (!poi) return;

    const script = poi.ttsScript[language]?.trim();

    if (!script) {
      Alert.alert('Thuyết minh', 'Chưa có thuyết minh bằng ngôn ngữ đang chọn.');
      return;
    }

    if (script.length > Speech.maxSpeechInputLength) {
      Alert.alert(
        'Nội dung quá dài',
        'Bài thuyết minh cần được chia thành các đoạn nhỏ trước khi phát.'
      );
      return;
    }

    speechTextRef.current = script;
    speechLanguageRef.current = LANG_TO_SPEECH[language];
    speechOffsetRef.current = 0;

    setPlayingPOIId(poiId);
    setPlayerProgress(0);
    setShowMiniPlayer(true);

    await speakFromOffset();
  };

  // Tạm dừng hoặc tiếp tục.
  const togglePlayback = async () => {
    if (!speechTextRef.current) return;

    if (speechActiveRef.current) {
      // Hủy hiệu lực callback cũ trước khi dừng.
      const session = ++speechSessionRef.current;

      speechActiveRef.current = false;
      setIsPlaying(false);

      try {
        await Speech.stop();
      } catch (error) {
        if (session !== speechSessionRef.current) return;

        console.warn('TTS stop error:', error);
        Alert.alert('Thuyết minh', 'Không thể dừng giọng đọc.');
      }

      return;
    }

    // Đã đọc hết thì phát lại từ đầu.
    if (speechOffsetRef.current >= speechTextRef.current.length) {
      speechOffsetRef.current = 0;
      setPlayerProgress(0);
    }

    await speakFromOffset();
  };

  // Dừng hẳn và xóa trạng thái trình phát.
  const stopPlayback = async () => {
    speechSessionRef.current += 1;
    speechActiveRef.current = false;
    speechTextRef.current = '';
    speechOffsetRef.current = 0;

    setPlayingPOIId(null);
    setIsPlaying(false);
    setPlayerProgress(0);
    setShowMiniPlayer(false);

    try {
      await Speech.stop();
    } catch (error) {
      console.warn('TTS stop error:', error);
      Alert.alert('Thuyết minh', 'Không thể dừng giọng đọc.');
    }
  };

  const [playingPOIId, setPlayingPOIId] = useState<string | null>(null);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <AppContext.Provider
      value={{
        // Navigation
        activeTab,
        setActiveTab,
        openPOI,
        closePOI,
        activePOIId,

        // Map
        userLat,
        userLng,
        setUserLocation,
        selectedMapPOIId,
        setSelectedMapPOIId,

        // Language & Settings
        language,
        setLanguage,
        langMenuOpen,
        setLangMenuOpen,
        autoPlay,
        setAutoPlay,
        triggerRadius,
        setTriggerRadius,
        locationMode,
        setLocationMode,
        wifiOnly,
        setWifiOnly,
        voice,
        setVoice,

        // Geofence / Demo
        activationRadius,
        setActivationRadius,
        demoLocation,
        setDemoLocation,
        isDemoMode,
        setIsDemoMode,

        // Explore
        exploreSearch,
        setExploreSearch,
        exploreCategory,
        setExploreCategory,
        exploreSort,
        setExploreSort,

        // Home Search
        homeSearch,
        setHomeSearch,
        selectedCategory,
        setSelectedCategory,

        // Downloads
        downloads,

        // Audio Player
        startPlayback,
        togglePlayback,
        stopPlayback,
        playingPOIId,
        isPlaying,
        playerProgress,
        speechRate,
        setSpeechRate,
        showMiniPlayer,
        selectedVoice,
        setSelectedVoice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
