import BottomNav from '@/components/BottomNav';
import HomeScreen from '@/screen/HomeScreen';
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
        <View className={`absolute inset-0 ${activeTab === 'explore' ? 'flex' : 'hidden'}`} />

        <View className={`absolute inset-0 ${activeTab === 'scan' ? 'flex' : 'hidden'}`} />

        <View className={`absolute inset-0 ${activeTab === 'download' ? 'flex' : 'hidden'}`} />

        <View className={`absolute inset-0 ${activeTab === 'settings' ? 'flex' : 'hidden'}`} />
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
