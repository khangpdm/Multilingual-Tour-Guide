import { DEMO_USER_LOCATIONS, LANG_TO_SPEECH, Language, POIS } from '@/data/pois';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

export type Tab = 'home' | 'explore' | 'scan' | 'download' | 'settings';

interface AppContextValue {
  //Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  openPOI: (id: string) => void;
  closePOI: () => void;
  activePOIId: string | null;

  //Map
  userLat: number;
  userLng: number;

  //Language
  language: Language;

  //Explore Screen
  exploreSearch: string;
  setExploreSearch: (q: string) => void;
  exploreCategory: string;
  setExploreCategory: (c: string) => void;
  exploreSort: 'distance' | 'name';
  setExploreSort: (s: 'distance' | 'name') => void;

  //Audio Player
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

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [exploreSearch, setExploreSearch] = useState('');
  const [exploreCategory, setExploreCategory] = useState('Tất cả');
  const [exploreSort, setExploreSort] = useState<'distance' | 'name'>('distance');
  const userLat = DEMO_USER_LOCATIONS.near.lat;
  const userLng = DEMO_USER_LOCATIONS.near.lng;
  const language: Language = 'vi';
  const [activePOIId, setActivePOIId] = useState<string | null>(null);

  const openPOI = (id: string) => {
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

        const voice = voices.find(
          (item) => item.identifier === selectedVoice || item.name === selectedVoice
        );

        voiceIdentifier = voice?.identifier;
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
        activeTab,
        setActiveTab,
        exploreSearch,
        setExploreSearch,
        exploreCategory,
        setExploreCategory,
        exploreSort,
        setExploreSort,
        userLat,
        userLng,
        openPOI,
        language,
        activePOIId,
        closePOI,
        showMiniPlayer,
        startPlayback,
        togglePlayback,
        stopPlayback,
        playingPOIId,
        isPlaying,
        playerProgress,
        speechRate,
        setSpeechRate,
        selectedVoice,
        setSelectedVoice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
