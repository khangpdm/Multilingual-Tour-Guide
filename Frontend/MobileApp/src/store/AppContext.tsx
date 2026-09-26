import { createContext, useContext, useState } from 'react';
export type Tab = 'home' | 'explore' | 'scan' | 'download' | 'settings';
export type Language = 'vi' | 'en' | 'fr' | 'ja' | 'ko' | 'zh';

interface AppContextValue {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
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
  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        language,
        setLanguage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
