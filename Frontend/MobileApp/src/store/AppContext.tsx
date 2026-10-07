import { createContext, useContext, useState } from 'react';
export type Tab = 'home' | 'explore' | 'scan' | 'download' | 'settings';
export type Language = 'vi' | 'en' | 'fr' | 'ja' | 'ko' | 'zh';
export type LocationMode = 'battery' | 'balanced' | 'accuracy';
export type VoiceId = 'an' | 'hoai-my' | 'nam-minh';

interface AppContextValue {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  language: Language;
  setLanguage: (language: Language) => void;
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
  speechRate: number;
  setSpeechRate: (rate: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [language, setLanguage] = useState<Language>('vi');
  const [autoPlay, setAutoPlay] = useState(true);
  const [triggerRadius, setTriggerRadius] = useState(100);
  const [locationMode, setLocationMode] = useState<LocationMode>('balanced');
  const [wifiOnly, setWifiOnly] = useState(true);
  const [voice, setVoice] = useState<VoiceId>('hoai-my');
  const [speechRate, setSpeechRate] = useState(1);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        language,
        setLanguage,
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
        speechRate,
        setSpeechRate,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
