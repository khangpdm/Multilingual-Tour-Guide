import { IconCheck, IconChevronRight, IconVolume } from '@/components/Icons';
import { Language, LocationMode, VoiceId, useApp } from '@/store/AppContext';
import React from 'react';
import { PanResponder, Pressable, ScrollView, Switch, Text, View } from 'react-native';

const TEAL = '#0aa99d';
const TEXT = '#102d4f';
const MUTED = '#8796ad';
const CARD = '#f8fafc';
const MIN_RADIUS = 20;
const MAX_RADIUS = 500;
const MIN_SPEECH_RATE = 0.5;
const MAX_SPEECH_RATE = 2;

const languages: { code: Language; label: string; name: string }[] = [
  { code: 'vi', label: 'VN', name: 'Tiếng Việt' },
  { code: 'en', label: 'US', name: 'English' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'ja', label: 'JP', name: '日本語' },
  { code: 'ko', label: 'KR', name: '한국어' },
  { code: 'zh', label: 'CN', name: '中文' },
];

const locationModes: { id: LocationMode; title: string; description: string }[] = [
  { id: 'battery', title: 'Tiết kiệm pin', description: 'Ít chính xác hơn' },
  { id: 'balanced', title: 'Cân bằng', description: 'Mặc định' },
  { id: 'accuracy', title: 'Độ chính xác cao', description: 'Tốn pin hơn' },
];

const voices: { id: VoiceId; title: string; description: string }[] = [
  { id: 'an', title: 'Microsoft An - Vietnamese (Vietnam)', description: 'vi-VN · Offline' },
  {
    id: 'hoai-my',
    title: 'Microsoft Hoài My Online (Natural) - Vietnamese (Vietnam)',
    description: 'vi-VN · Online',
  },
  {
    id: 'nam-minh',
    title: 'Microsoft Nam Minh Online (Natural) - Vietnamese',
    description: 'vi-VN · Online',
  },
];

function SectionTitle({
  children,
  withTopSpacing = false,
}: {
  children: string;
  withTopSpacing?: boolean;
}) {
  return (
    <Text
      style={{
        color: MUTED,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: withTopSpacing ? 16 : 0,
      }}
    >
      {children}
    </Text>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#d9e0e8', true: TEAL }}
      thumbColor="#fff"
      ios_backgroundColor="#d9e0e8"
    />
  );
}

function LanguageOption({
  code,
  label,
  name,
  selected,
  onPress,
}: {
  code: Language;
  label: string;
  name: string;
  selected: boolean;
  onPress: (code: Language) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(code)}
      style={{
        backgroundColor: selected ? '#effcfb' : CARD,
        borderColor: selected ? TEAL : '#edf0f4',
        borderRadius: 10,
        borderWidth: 1,
        flex: 1,
        height: 38,
        justifyContent: 'center',
        paddingHorizontal: 11,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}>
        <Text style={{ color: TEXT, fontSize: 10, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: TEXT, fontSize: 11 }}>{name}</Text>
        {selected && <IconCheck size={14} color={TEAL} />}
      </View>
    </Pressable>
  );
}

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
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const [speechRateSliderWidth, setSpeechRateSliderWidth] = React.useState(0);
  const radiusPanResponder = React.useMemo(() => {
    const dragState = { startPosition: 0 };
    const updateRadiusFromPosition = (position: number) => {
      if (sliderWidth <= 0) return;
      const percentage = Math.min(1, Math.max(0, position / sliderWidth));
      const nextRadius = Math.round(MIN_RADIUS + percentage * (MAX_RADIUS - MIN_RADIUS));
      setTriggerRadius(nextRadius);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        dragState.startPosition = event.nativeEvent.locationX;
        updateRadiusFromPosition(dragState.startPosition);
      },
      onPanResponderMove: (_, gestureState) =>
        updateRadiusFromPosition(dragState.startPosition + gestureState.dx),
    });
  }, [setTriggerRadius, sliderWidth]);
  const radiusPercentage = ((triggerRadius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100;
  const innerRadiusSize = 16 + (radiusPercentage / 100) * 46;
  const updateSpeechRateFromPosition = React.useCallback(
    (position: number) => {
      if (speechRateSliderWidth <= 0) return;
      const percentage = Math.min(1, Math.max(0, position / speechRateSliderWidth));
      const nextRate = MIN_SPEECH_RATE + percentage * (MAX_SPEECH_RATE - MIN_SPEECH_RATE);
      setSpeechRate(Math.round(nextRate * 20) / 20);
    },
    [setSpeechRate, speechRateSliderWidth]
  );
  const speechRatePanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateSpeechRateFromPosition(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateSpeechRateFromPosition(event.nativeEvent.locationX),
      }),
    [updateSpeechRateFromPosition]
  );
  const speechRatePercentage =
    ((speechRate - MIN_SPEECH_RATE) / (MAX_SPEECH_RATE - MIN_SPEECH_RATE)) * 100;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 16, paddingTop: 12 }}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: '#f7f9fb', flex: 1 }}
    >
      <Text style={{ color: TEXT, fontSize: 20, fontWeight: '700', marginBottom: 18 }}>
        Cài đặt
      </Text>

      <SectionTitle>NGÔN NGỮ</SectionTitle>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          elevation: 1,
          padding: 12,
          shadowColor: '#cbd5e1',
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <Text style={{ color: MUTED, fontSize: 10, marginBottom: 8 }}>
          Ngôn ngữ giao diện và thuyết minh
        </Text>
        <View style={{ gap: 6 }}>
          {[languages.slice(0, 2), languages.slice(2, 4), languages.slice(4, 6)].map(
            (row, index) => (
              <View key={index} style={{ flexDirection: 'row', gap: 6 }}>
                {row.map((item) => (
                  <LanguageOption
                    key={item.code}
                    {...item}
                    selected={language === item.code}
                    onPress={setLanguage}
                  />
                ))}
              </View>
            )
          )}
        </View>
      </View>

      <SectionTitle withTopSpacing>GPS VÀ TỰ ĐỘNG PHÁT</SectionTitle>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          elevation: 1,
          marginBottom: 16,
          shadowColor: '#cbd5e1',
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <View style={{ padding: 14 }}>
          <View
            style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <View>
              <Text style={{ color: TEXT, fontSize: 12, fontWeight: '600' }}>
                Tự động phát khi đến gần
              </Text>
              <Text style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>
                Phát thuyết minh khi vào vùng kích hoạt
              </Text>
            </View>
            <Toggle value={autoPlay} onChange={setAutoPlay} />
          </View>
          <View style={{ marginTop: 18 }}>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: TEXT, fontSize: 12, fontWeight: '600' }}>
                Bán kính kích hoạt
              </Text>
              <Text style={{ color: TEAL, fontSize: 12, fontWeight: '700' }}>
                {triggerRadius} m
              </Text>
            </View>
            <View
              {...radiusPanResponder.panHandlers}
              accessibilityLabel="Bán kính kích hoạt"
              accessibilityRole="adjustable"
              onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
              style={{ height: 30, justifyContent: 'center' }}
            >
              <View style={{ backgroundColor: '#b9f1ec', height: 3 }}>
                <View style={{ backgroundColor: TEAL, height: 3, width: `${radiusPercentage}%` }} />
                <View
                  style={{
                    backgroundColor: TEAL,
                    borderRadius: 8,
                    height: 14,
                    left: `${radiusPercentage}%`,
                    marginLeft: -7,
                    position: 'absolute',
                    top: -5,
                    width: 14,
                  }}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: MUTED, fontSize: 9 }}>20 m</Text>
              <Text style={{ color: MUTED, fontSize: 9 }}>500 m</Text>
            </View>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <View
              style={{
                alignItems: 'center',
                borderColor: '#8eece5',
                borderRadius: 32,
                borderWidth: 1,
                height: 64,
                justifyContent: 'center',
                width: 64,
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: '#fff1dc',
                  borderColor: '#ffb45c',
                  borderRadius: innerRadiusSize / 2,
                  borderWidth: 1,
                  height: innerRadiusSize,
                  justifyContent: 'center',
                  width: innerRadiusSize,
                }}
              >
                <View
                  style={{
                    backgroundColor: '#ff9f32',
                    borderRadius: 4,
                    height: 8,
                    width: 8,
                  }}
                />
              </View>
            </View>
            <Text style={{ color: MUTED, fontSize: 9, marginTop: 10 }}>
              Bán kính hoạt động (không phải độ chính xác GPS)
            </Text>
          </View>
        </View>
        <View style={{ borderTopColor: '#f0f2f5', borderTopWidth: 1, padding: 14 }}>
          <Text style={{ color: TEXT, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
            Chế độ cập nhật vị trí
          </Text>
          <View style={{ gap: 6 }}>
            {locationModes.map((mode) => {
              const selected = mode.id === locationMode;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => setLocationMode(mode.id)}
                  style={{
                    backgroundColor: selected ? '#effcfb' : CARD,
                    borderColor: selected ? TEAL : '#edf0f4',
                    borderRadius: 10,
                    borderWidth: 1,
                    minHeight: 44,
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                  }}
                >
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View>
                      <Text style={{ color: TEXT, fontSize: 11, fontWeight: '600' }}>
                        {mode.title}
                      </Text>
                      <Text style={{ color: MUTED, fontSize: 9, marginTop: 2 }}>
                        {mode.description}
                      </Text>
                    </View>
                    {selected && <IconCheck size={14} color={TEAL} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: MUTED, fontSize: 9, lineHeight: 13, marginTop: 8 }}>
            Ứng dụng không thể cải thiện độ chính xác GPS vượt quá khả năng phần cứng của thiết bị.
          </Text>
        </View>
      </View>

      <SectionTitle>GIỌNG ĐỌC TTS</SectionTitle>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          elevation: 1,
          marginBottom: 16,
          padding: 14,
          shadowColor: '#cbd5e1',
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <Text style={{ color: MUTED, fontSize: 10, marginBottom: 8 }}>
          Giọng tương thích với{' '}
          <Text style={{ color: TEAL, fontWeight: '700' }}>vn Tiếng Việt</Text>
        </Text>
        {voices.map((voiceOption) => {
          const selected = voice === voiceOption.id;
          return (
            <Pressable
              key={voiceOption.id}
              onPress={() => setVoice(voiceOption.id)}
              style={{
                backgroundColor: selected ? '#effcfb' : CARD,
                borderColor: selected ? TEAL : '#edf0f4',
                borderRadius: 10,
                borderWidth: 1,
                marginBottom: 6,
                padding: 9,
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text numberOfLines={2} style={{ color: TEXT, fontSize: 11 }}>
                    {voiceOption.title}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 9, marginTop: 3 }}>
                    {voiceOption.description}
                  </Text>
                </View>
                {selected && <IconCheck size={14} color={TEAL} />}
              </View>
            </Pressable>
          );
        })}
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 10,
          }}
        >
          <Text style={{ color: TEXT, fontSize: 12, fontWeight: '600' }}>Tốc độ đọc</Text>
          <Text style={{ color: TEAL, fontSize: 12, fontWeight: '700' }}>
            {speechRate.toFixed(2)}×
          </Text>
        </View>
        <View
          {...speechRatePanResponder.panHandlers}
          accessibilityLabel="Tốc độ đọc"
          accessibilityRole="adjustable"
          onLayout={(event) => setSpeechRateSliderWidth(event.nativeEvent.layout.width)}
          style={{ backgroundColor: '#b9f1ec', height: 24, justifyContent: 'center', marginTop: 6 }}
        >
          <View style={{ backgroundColor: TEAL, height: 3, width: `${speechRatePercentage}%` }} />
          <View
            style={{
              backgroundColor: TEAL,
              borderRadius: 8,
              height: 14,
              left: `${speechRatePercentage}%`,
              marginLeft: -7,
              position: 'absolute',
              top: 5,
              width: 14,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
          <Text style={{ color: MUTED, fontSize: 9 }}>0.5×</Text>
          <Text style={{ color: MUTED, fontSize: 9 }}>2.0×</Text>
        </View>
        <Pressable
          style={{
            alignItems: 'center',
            backgroundColor: TEAL,
            borderRadius: 10,
            flexDirection: 'row',
            height: 34,
            justifyContent: 'center',
            marginTop: 10,
          }}
        >
          <IconVolume color="#fff" size={15} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 7 }}>
            Nghe thử
          </Text>
        </Pressable>
      </View>

      <SectionTitle>NỘI DUNG OFFLINE</SectionTitle>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          elevation: 1,
          padding: 14,
          shadowColor: '#cbd5e1',
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <View
          style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}
        >
          <View>
            <Text style={{ color: TEXT, fontSize: 12, fontWeight: '600' }}>Chỉ tải qua Wi-Fi</Text>
            <Text style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>
              Tiết kiệm dữ liệu di động
            </Text>
          </View>
          <Toggle value={wifiOnly} onChange={setWifiOnly} />
        </View>
        <View
          style={{ borderTopColor: '#f0f2f5', borderTopWidth: 1, marginTop: 14, paddingTop: 14 }}
        >
          <View
            style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text style={{ color: TEXT, fontSize: 12 }}>Dung lượng đã tải</Text>
            <Text style={{ color: TEXT, fontSize: 12 }}>45 MB</Text>
          </View>
          <Pressable
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 16,
            }}
          >
            <Text style={{ color: TEAL, fontSize: 12, fontWeight: '600' }}>
              Quản lý gói offline
            </Text>
            <IconChevronRight color={TEAL} size={16} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
