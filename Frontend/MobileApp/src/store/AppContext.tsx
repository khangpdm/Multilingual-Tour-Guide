import { createContext, useContext, useState } from 'react';
import { Language, DEMO_USER_LOCATIONS} from '@/data/pois';
export type Tab = 'home' | 'explore' | 'scan' | 'download' | 'settings';
export type DownloadStatus = 'none' | 'downloading' | 'done' | 'failed';

interface AppContextValue {
  //Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  openPOI: (id: string) => void;
  activePOIId: string | null;

  //Map
  userLat: number;
  userLng: number;

  //Language
  language : Language;

  //Explore Screen
  exploreSearch: string;
  setExploreSearch: (q: string) => void;
  exploreCategory: string;
  setExploreCategory: (c: string) => void;
  exploreSort: 'distance' | 'name';
  setExploreSort: (s: 'distance' | 'name') => void;

  //Download Screen
  downloads: Record<string, DownloadStatus>;

}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>('home');  
  const [exploreSearch, setExploreSearch] = useState('');
  const [exploreCategory, setExploreCategory] = useState('Tất cả');
  const [exploreSort, setExploreSort] = useState<'distance' | 'name'>('distance');
  const [downloads, setDownloads] = useState<Record<string, DownloadStatus>>({});
  const userLat = DEMO_USER_LOCATIONS.near.lat;
  const userLng = DEMO_USER_LOCATIONS.near.lng;
  const language: Language = 'vi';
  const [activePOIId, setActivePOIId] = useState<string | null>(null);
  const openPOI = (id: string) => {
    setActivePOIId(id);
  };
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
        downloads,
        userLat, userLng, openPOI, language, activePOIId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
