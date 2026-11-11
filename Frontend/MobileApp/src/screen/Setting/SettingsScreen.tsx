import GpsSettings from '@/screen/Setting/components/GpsSettings';
import LanguageSettings from '@/screen/Setting/components/LanguageSettings';
import OfflineSettings from '@/screen/Setting/components/OfflineSettings';
import SettingSectionTitle from '@/screen/Setting/components/SettingSectionTitle';
import VoiceSettings from '@/screen/Setting/components/VoiceSettings';
import { useApp } from '@/store/AppContext';
import React from 'react';
import { ScrollView, Text } from 'react-native';

export default function SettingsScreen() {
  const {
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
  } = useApp();

  return (
    <ScrollView
      contentContainerClassName="px-4 pb-7 pt-3"
      showsVerticalScrollIndicator={false}
      className="flex-1 bg-[#f7f9fb]"
    >
      <Text className="mb-[18px] text-[20px] font-bold text-[#102d4f]">Cài đặt</Text>

      <SettingSectionTitle>NGÔN NGỮ</SettingSectionTitle>
      <LanguageSettings language={language} onLanguageChange={setLanguage} />

      <SettingSectionTitle withTopSpacing>GPS VÀ TỰ ĐỘNG PHÁT</SettingSectionTitle>
      <GpsSettings
        autoPlay={autoPlay}
        onAutoPlayChange={setAutoPlay}
        triggerRadius={triggerRadius}
        onRadiusChange={setTriggerRadius}
        locationMode={locationMode}
        onLocationModeChange={setLocationMode}
      />

      <SettingSectionTitle>GIỌNG ĐỌC TTS</SettingSectionTitle>
      <VoiceSettings
        voice={voice}
        onVoiceChange={setVoice}
        speechRate={speechRate}
        onSpeechRateChange={setSpeechRate}
      />

      <SettingSectionTitle>NỘI DUNG OFFLINE</SettingSectionTitle>
      <OfflineSettings wifiOnly={wifiOnly} onWifiOnlyChange={setWifiOnly} />
    </ScrollView>
  );
}
