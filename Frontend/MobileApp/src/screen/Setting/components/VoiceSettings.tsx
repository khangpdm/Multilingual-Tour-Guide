import { IconCheck, IconVolume } from '@/components/Icons';
import { VoiceId } from '@/store/AppContext';
import React from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';

const MIN_RATE = 0.5;
const MAX_RATE = 2;

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

export default function VoiceSettings({
  voice,
  onVoiceChange,
  speechRate,
  onSpeechRateChange,
}: {
  voice: VoiceId;
  onVoiceChange: (voice: VoiceId) => void;
  speechRate: number;
  onSpeechRateChange: (rate: number) => void;
}) {
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const speechRatePanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateSpeechRate(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateSpeechRate(event.nativeEvent.locationX),
      }),
    // The responder is recreated when the measured width changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sliderWidth]
  );

  function updateSpeechRate(position: number) {
    if (sliderWidth <= 0) return;
    const percentage = Math.min(1, Math.max(0, position / sliderWidth));
    const rate = MIN_RATE + percentage * (MAX_RATE - MIN_RATE);
    onSpeechRateChange(Math.round(rate * 20) / 20);
  }

  const ratePercentage = ((speechRate - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100;

  return (
    <View className="mb-4 rounded-2xl bg-white p-[14px] shadow-sm">
      <Text className="mb-2 text-[10px] text-[#8796ad]">
        Giọng tương thích với <Text className="font-bold text-[#0aa99d]">vn Tiếng Việt</Text>
      </Text>
      {voices.map((voiceOption) => {
        const selected = voice === voiceOption.id;
        return (
          <Pressable
            key={voiceOption.id}
            onPress={() => onVoiceChange(voiceOption.id)}
            className={`mb-[6px] rounded-[10px] border p-[9px] ${
              selected ? 'border-[#0aa99d] bg-[#effcfb]' : 'border-[#edf0f4] bg-[#f8fafc]'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text numberOfLines={2} className="text-[11px] text-[#102d4f]">
                  {voiceOption.title}
                </Text>
                <Text className="mt-[3px] text-[9px] text-[#8796ad]">
                  {voiceOption.description}
                </Text>
              </View>
              {selected && <IconCheck size={14} color="#0aa99d" />}
            </View>
          </Pressable>
        );
      })}

      <View className="mt-[10px] flex-row items-center justify-between">
        <Text className="text-[12px] font-semibold text-[#102d4f]">Tốc độ đọc</Text>
        <Text className="text-[12px] font-bold text-[#0aa99d]">{speechRate.toFixed(2)}×</Text>
      </View>
      <View
        {...speechRatePanResponder.panHandlers}
        accessibilityLabel="Tốc độ đọc"
        accessibilityRole="adjustable"
        onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
        className="mt-[6px] h-6 justify-center bg-[#b9f1ec]"
      >
        <View className="h-[3px] bg-[#0aa99d]" style={{ width: `${ratePercentage}%` }} />
        <View
          className="absolute top-[5px] h-[14px] w-[14px] rounded-[8px] bg-[#0aa99d]"
          style={{ left: `${ratePercentage}%`, marginLeft: -7 }}
        />
      </View>
      <View className="mt-[7px] flex-row justify-between">
        <Text className="text-[9px] text-[#8796ad]">0.5×</Text>
        <Text className="text-[9px] text-[#8796ad]">2.0×</Text>
      </View>
      <Pressable className="mt-[10px] h-[34px] flex-row items-center justify-center rounded-[10px] bg-[#0aa99d]">
        <IconVolume color="#fff" size={15} />
        <Text className="ml-[7px] text-[11px] font-bold text-white">Nghe thử</Text>
      </Pressable>
    </View>
  );
}
