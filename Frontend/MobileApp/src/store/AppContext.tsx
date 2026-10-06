import { DEMO_USER_LOCATIONS, Language } from '@/data/pois';
import React, { createContext, useContext, useState } from 'react';

export type Tab = 'home' | 'explore' | 'scan' | 'download' | 'settings';
export type DemoLocation = 'near' | 'far';

interface AppContextValue {
  // Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

  // Language & Language Menu Modal
  language: Language;
  setLanguage: (lang: Language) => void;
  langMenuOpen: boolean;
  setLangMenuOpen: (open: boolean) => void;

  // POI Navigation & Selection
  selectedMapPOIId: string | null;
  setSelectedMapPOIId: (id: string | null) => void;
  activePOIId: string | null;
  openPOI: (id: string) => void;
  closePOI: () => void;

  // Search & Filter (Tìm kiếm & Bộ lọc)
  homeSearch: string;
  setHomeSearch: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;

  // Geofence
  userLat: number;
  userLng: number;
  setUserLocation: (lat: number, lng: number) => void;
  activationRadius: number;
  setActivationRadius: (r: number) => void;
  demoLocation: DemoLocation;
  setDemoLocation: (m: DemoLocation) => void;

  isDemoMode: boolean;
  setIsDemoMode: (v: boolean) => void;

  // 6. Audio Player / Thuyết minh (TTS)
  isPlaying: boolean;
  playingPOIId: string | null;
  startPlayback: (poiId: string) => void;
  stopPlayback: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // Language
  const [language, setLanguage] = useState<Language>('vi');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // POI selection
  const [selectedMapPOIId, setSelectedMapPOIId] = useState<string | null>(null);
  const [activePOIId, setActivePOIId] = useState<string | null>(null);

  // Search & Filter
  const [homeSearch, setHomeSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  // User location / Geofencing
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoLocation, setDemoLocationState] = useState<DemoLocation>('near');
  const [activationRadius, setActivationRadius] = useState(1000); // Mặc định 1000m

  // Mặc định lấy tọa độ từ DEMO_USER_LOCATIONS['near']
  const initialLocation = DEMO_USER_LOCATIONS?.near || { lat: 10.7769, lng: 106.7009 };
  const [userLat, setUserLat] = useState<number>(initialLocation.lat);
  const [userLng, setUserLng] = useState<number>(initialLocation.lng);

  // Cập nhật vị trí GPS thực từ Mapbox UserLocation
  const setDemoLocation = (mode: DemoLocation) => {
    setDemoLocationState(mode);
    setIsDemoMode(true); // Tự động bật chế độ Demo khi người dùng chọn Gần / Xa

    if (DEMO_USER_LOCATIONS?.[mode]) {
      setUserLat(DEMO_USER_LOCATIONS[mode].lat);
      setUserLng(DEMO_USER_LOCATIONS[mode].lng);
    }
  };

  const setUserLocation = (lat: number, lng: number) => {
    // Chỉ cập nhật tọa độ thực từ Mapbox nếu KHÔNG ở trong Demo Mode
    if (!isDemoMode) {
      setUserLat(lat);
      setUserLng(lng);
    }
  };

  // Audio state (Audio Player)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingPOIId, setPlayingPOIId] = useState<string | null>(null);

  const openPOI = (id: string) => {
    setActivePOIId(id);
  };

  const closePOI = () => {
    setActivePOIId(null);
  };

  const startPlayback = (poiId: string) => {
    setPlayingPOIId(poiId);
    setIsPlaying(true);
    // Bạn có thể gắn logic expo-speech hoặc audio player tại đây
  };

  const stopPlayback = () => {
    setPlayingPOIId(null);
    setIsPlaying(false);
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        language,
        setLanguage,
        langMenuOpen,
        setLangMenuOpen,
        selectedMapPOIId,
        setSelectedMapPOIId,
        activePOIId,
        openPOI,
        closePOI,
        homeSearch,
        setHomeSearch,
        selectedCategory,
        setSelectedCategory,
        userLat,
        userLng,
        setUserLocation,
        activationRadius,
        setActivationRadius,
        demoLocation,
        setDemoLocation,
        isDemoMode,
        setIsDemoMode,
        isPlaying,
        playingPOIId,
        startPlayback,
        stopPlayback,
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
