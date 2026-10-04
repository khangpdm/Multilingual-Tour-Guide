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

  // Geofence(Tọa độ người dùng)
  userLat: number;
  userLng: number;
  activationRadius: number;
  setActivationRadius: (r: number) => void;
  demoLocation: DemoLocation;
  setDemoLocation: (m: DemoLocation) => void;

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
  const [demoLocation, setDemoLocation] = useState<DemoLocation>('near');
  const [activationRadius, setActivationRadius] = useState(200); // Mặc định 200m

  // Lấy tọa độ giả lập/thực tế dựa trên demoLocation
  const userLat = DEMO_USER_LOCATIONS?.[demoLocation]?.lat ?? 10.7769;
  const userLng = DEMO_USER_LOCATIONS?.[demoLocation]?.lng ?? 106.7009;

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
        activationRadius,
        setActivationRadius,
        demoLocation,
        setDemoLocation,
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
