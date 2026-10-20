import BottomNav from '@/components/BottomNav';
import DownloadScreen from '@/screen/DownloadScreen/DownloadScreen';
import ExploreScreen from '@/screen/ExploreScreen/ExploreScreen';
import HomeScreen from '@/screen/HomeScreen/HomeScreen';
import QRScanScreen from '@/screen/QRScreen/QRScreen';
import SettingsScreen from '@/screen/Setting/SettingsScreen';
import { AppProvider, useApp } from '@/store/AppContext';
import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

function AppShell() {
  const { activeTab } = useApp();

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View className="flex-1 w-full relative">
        <View className={`absolute inset-0 ${activeTab === 'home' ? 'flex' : 'hidden'}`}>
          <HomeScreen />
        </View>

        <View className={`absolute inset-0 ${activeTab === 'explore' ? 'flex' : 'hidden'}`}>
          <ExploreScreen />
        </View>

        <View className={`absolute inset-0 ${activeTab === 'scan' ? 'flex' : 'hidden'}`}>
          <QRScanScreen />
        </View>

        <View className={`absolute inset-0 ${activeTab === 'download' ? 'flex' : 'hidden'}`}>
          <DownloadScreen />
        </View>

        <View className={`absolute inset-0 ${activeTab === 'settings' ? 'flex' : 'hidden'}`}>
          <SettingsScreen />
        </View>
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}
