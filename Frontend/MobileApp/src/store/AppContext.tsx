import { DEMO_USER_LOCATIONS, Language, POIS } from '@/data/pois';
import { fetchActiveLanguages, LanguageItem } from '@/services/languageService';
import { fetchPOIs, fetchOfflinePOIs, POI } from '@/services/poiService';
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  requestSynthesizeAudio,
  getAudioTaskStatus,
  getAudioFileUrl,
  resolvedAudioUrl,
} from '@/services/audioService';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import i18n, { changeAppLanguage } from '@/i18n';
import { listOfflineInstalls, loadOfflinePOIs } from '@/services/offlineService';
import { findOfflineAudioUri, getOfflinePackMetadata } from '@/services/offlinePackService';

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
  pois: POI[];
  setPoiList: React.Dispatch<React.SetStateAction<POI[]>>;
  poiLoadError: boolean;
  reloadPOIs: () => void;

  // Language
  supportedLanguages: LanguageItem[];
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
  hasFollowed: boolean;
  setHasFollowed: React.Dispatch<React.SetStateAction<boolean>>;
  userCoordinates: [number, number] | null;
  setUserCoordinates: React.Dispatch<React.SetStateAction<[number, number] | null>>;

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
  offlineBytes: number;

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
  const [supportedLanguages, setSupportedLanguages] = useState<LanguageItem[]>([
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
  ]);
  const [language, setLanguageState] = useState<Language>('vi');
  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    void changeAppLanguage(nextLanguage);
  };
  useEffect(() => {
    const syncLanguage = (nextLanguage: string) => {
      if (['vi', 'en', 'fr', 'ja', 'ko', 'zh'].includes(nextLanguage)) {
        setLanguageState(nextLanguage as Language);
      }
    };
    i18n.on('languageChanged', syncLanguage);
    syncLanguage(i18n.language);
    return () => {
      i18n.off('languageChanged', syncLanguage);
    };
  }, []);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [voice, setVoice] = useState<VoiceId>('hoai-my');

  // POI selection
  const [selectedMapPOIId, setSelectedMapPOIId] = useState<string | null>(null);
  const [activePOIId, setActivePOIId] = useState<string | null>(null);

  // Search & Filter
  const [homeSearch, setHomeSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [exploreSearch, setExploreSearch] = useState('');
  const [exploreCategory, setExploreCategory] = useState('all');
  const [exploreSort, setExploreSort] = useState<'distance' | 'name'>('distance');

  // Downloads
  const [downloads, setDownloads] = useState<Record<string, DownloadStatus>>({});
  const [offlineBytes, setOfflineBytes] = useState(0);

  // User location / Geofencing
  const [hasFollowed, setHasFollowed] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<[number, number] | null>(null);
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
  const [playingPOIId, setPlayingPOIId] = useState<string | null>(null);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [speechRate, setSpeechRateState] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  // --- EXPO-AUDIO PLAYER & FALLBACK LOGIC ---
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.remove();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const statusSubscriptionRef = useRef<any>(null);

  const playAudioUrl = async (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        if (statusSubscriptionRef.current) {
          statusSubscriptionRef.current.remove();
          statusSubscriptionRef.current = null;
        }
        if (audioPlayerRef.current) {
          try {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.remove();
          } catch (e) {}
          audioPlayerRef.current = null;
        }

        const player = createAudioPlayer({ uri: url });
        player.setPlaybackRate(speechRate, 'high');
        audioPlayerRef.current = player;

        let resolved = false;

        statusSubscriptionRef.current = player.addListener(
          'playbackStatusUpdate',
          (status: any) => {
            if (status.error) {
              if (!resolved) {
                resolved = true;
                resolve(false);
              }
            }
            if (status.isLoaded) {
              if (!resolved) {
                resolved = true;
                try {
                  player.seekTo(0);
                } catch (e) {}

                player.play();
                setIsPlaying(true);
                resolve(true);
              }

              setIsPlaying(status.playing);

              if (status.duration > 0) {
                setPlayerProgress((status.currentTime / status.duration) * 100);
              }

              if (status.didJustFinish) {
                setIsPlaying(false);
                setPlayerProgress(100);
              }
            }
          }
        );

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }, 4000);
      } catch (error) {
        resolve(false);
      }
    });
  };

  const waitForTaskCompletion = async (taskId: string, maxAttempts = 15): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const taskData = await getAudioTaskStatus(taskId);
        const state = taskData?.state || taskData?.status;
        if (state === 'COMPLETED' || state === 'completed') {
          return true;
        }
        if (state === 'FAILED' || state === 'failed') {
          return false;
        }
      } catch (e) {}
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Đợi 2s mỗi lần kiểm tra
    }
    return false;
  };

  const startPlayback = async (poiId: string) => {
    const targetLang = language;
    setPlayingPOIId(poiId);
    setShowMiniPlayer(true);
    setPlayerProgress(0);

    const selected = pois.find((item) => item.id === poiId);
    const selectedAudio = selected?.audioUrls?.[targetLang] || selected?.audioUrls?.en;
    if (selectedAudio?.startsWith('file://') && (await playAudioUrl(selectedAudio))) return;

    // BƯỚC 1: Ưu tiên audio đã tải về thiết bị.
    try {
      const localAudioUri = await findOfflineAudioUri(poiId, targetLang);

      if (localAudioUri) {
        console.log(`[OfflineAudio] Phát audio local: ${localAudioUri}`);

        const successLocal = await playAudioUrl(localAudioUri);

        if (successLocal) return;

        console.warn('[OfflineAudio] Phát audio local thất bại.');
      } else {
        console.log(`[OfflineAudio] Không tìm thấy audio local cho ${poiId}/${targetLang}`);
      }
    } catch (error) {
      console.warn('[OfflineAudio] Lỗi đọc audio local:', error);
    }

    // Fallback sang Backend.
    const primaryAudioUrl = getAudioFileUrl(poiId, targetLang);

    console.log(`[Audio] Thử phát URL trực tiếp: ${primaryAudioUrl}`);

    const successCurrent = await playAudioUrl(primaryAudioUrl);
    if (successCurrent) return;

    // BƯỚC 2: Gọi POST /audio/synthesize
    console.log(`[Audio Fallback] Chưa có sẵn file [${targetLang}]. Đang gọi API synthesize...`);
    try {
      const response = await requestSynthesizeAudio(poiId, targetLang);

      if (response.status === 'ready') {
        const successReady = await playAudioUrl(
          resolvedAudioUrl(response.audio_url) || primaryAudioUrl
        );
        if (successReady) return;
      }
      // Nếu backend đưa vào hàng đợi ("queued") và trả về task_id
      else if (response.status === 'queued' && response.task_id) {
        console.log(`[Audio Fallback] Đã xếp hàng task: ${response.task_id}. Đang chờ render...`);
        const isCompleted = await waitForTaskCompletion(response.task_id);

        if (isCompleted) {
          const retrySuccess = await playAudioUrl(primaryAudioUrl);
          if (retrySuccess) return;
        }
      }
    } catch (e) {
      console.warn('[Audio Fallback] Lỗi khi gọi synthesize hoặc chờ task:', e);
    }

    // BƯỚC 3: Fallback cuối cùng sang Tiếng Anh ('en') nếu tất cả thất bại
    if (targetLang !== 'en') {
      console.log(
        '[Audio Fallback] Quá trình tạo audio thất bại. Đang chuyển sang phát file tiếng Anh (en) mặc định...'
      );
      const fallbackEnUrl = getAudioFileUrl(poiId, 'en');
      const successEn = await playAudioUrl(fallbackEnUrl);
      if (successEn) return;
    }

    try {
      const offline = (await loadOfflinePOIs()).find((item) => item.id === poiId);
      const offlineAudio = offline?.audioUrls?.[targetLang] || offline?.audioUrls?.en;
      if (offlineAudio && (await playAudioUrl(offlineAudio))) return;
    } catch {}
    Alert.alert(i18n.t('detail.audioNarration'), i18n.t('detail.noAudio'));
    setIsPlaying(false);
  };

  const togglePlayback = async () => {
    const player = audioPlayerRef.current;

    if (!player) {
      console.warn('[Audio] Player không tồn tại.');
      return;
    }

    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        // Nếu audio đã phát hết thì tua về đầu.
        if (playerProgress >= 100) {
          await player.seekTo(0);
          setPlayerProgress(0);
        }

        player.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.warn('[Audio] Toggle playback error:', error);
    }
  };

  const stopPlayback = async () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.remove();
      audioPlayerRef.current = null;
    }
    setPlayingPOIId(null);
    setIsPlaying(false);
    setPlayerProgress(0);
    setShowMiniPlayer(false);
  };

  const setSpeechRate = (rate: number) => {
    setSpeechRateState(rate);
    const player = audioPlayerRef.current;
    if (player) {
      player.setPlaybackRate(rate, 'high');
    }
  };
  // ------------------------------------------

  useEffect(() => {
    async function loadLanguages() {
      const langs = await fetchActiveLanguages();
      if (langs.length > 0) {
        setSupportedLanguages(langs);
      }
    }
    loadLanguages();
  }, []);

  const [pois, setPoiList] = useState<POI[]>([]);
  const [poiLoadError, setPoiLoadError] = useState(false);
  const [poiRefresh, setPoiRefresh] = useState(0);
  const reloadPOIs = () => setPoiRefresh((value) => value + 1);

  useEffect(() => {
    let closed = false;
    let pending = false;
    async function loadPOIsFromServer() {
      if (pending) return;
      pending = true;
      try {
        if (isDemoMode) {
          await Promise.resolve();
          if (!closed) {
            setPoiList(POIS);
            setPoiLoadError(false);
          }
          return;
        }
        const installs = await listOfflineInstalls();
        if (!closed) {
          setOfflineBytes(installs.reduce((total, item) => total + item.bytes, 0));
          setDownloads(
            Object.fromEntries(
              installs.flatMap((item) => item.pois.map((poi) => [poi.id, 'done' as const]))
            )
          );
        }
        const serverPOIs = await fetchPOIs();
        if (!closed) {
          setPoiList(serverPOIs);
          setPoiLoadError(false);
        }
      } catch {
        if (!closed) setPoiLoadError(true);

        // Ưu tiên POI từ ZIP Offline Pack.
        const offlinePOIs = new Map<string, POI>();

        try {
          const metadata = await getOfflinePackMetadata();

          const readyPacks = Object.values(metadata).filter(
            (pack) => pack.status === 'ready' && Boolean(pack.languages?.[language])
          );

          const zipResults = await Promise.all(
            readyPacks.map((pack) =>
              fetchOfflinePOIs(pack.zone_id, language).catch((error) => {
                console.warn(`[OfflinePack] Không đọc được zone ${pack.zone_id}:`, error);
                return [];
              })
            )
          );

          for (const poisFromPack of zipResults) {
            for (const poi of poisFromPack) {
              if (!offlinePOIs.has(poi.id)) {
                offlinePOIs.set(poi.id, poi);
              }
            }
          }
        } catch (error) {
          console.warn('[OfflinePack] Không thể đọc metadata:', error);
        }

        // Bổ sung POI còn thiếu từ Offline Resource.
        try {
          const saved = await loadOfflinePOIs();

          for (const poi of saved) {
            if (!offlinePOIs.has(poi.id)) {
              offlinePOIs.set(poi.id, poi);
            }
          }
        } catch (error) {
          console.warn('[OfflineResource] Không thể đọc POI:', error);
        }

        if (!closed) {
          setPoiList([...offlinePOIs.values()]);
        }
      } finally {
        pending = false;
      }
    }
    void loadPOIsFromServer();
    const timer = setInterval(() => {
      void loadPOIsFromServer();
    }, 30000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [isDemoMode, poiRefresh, language]);

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
        pois,
        setPoiList,
        poiLoadError,
        reloadPOIs,

        // Language & Settings
        supportedLanguages,
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
        hasFollowed,
        setHasFollowed,
        userCoordinates,
        setUserCoordinates,
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
        offlineBytes,

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
