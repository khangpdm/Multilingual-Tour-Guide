import { IconCheck } from '@/components/Icons';
import { LocationMode } from '@/store/AppContext';
import React from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import SettingsToggle from './SettingsToggle';

const MIN_RADIUS = 20;
const MAX_RADIUS = 500;

const locationModes: { id: LocationMode; title: string; description: string }[] = [
  { id: 'battery', title: 'Tiết kiệm pin', description: 'Ít chính xác hơn' },
  { id: 'balanced', title: 'Cân bằng', description: 'Mặc định' },
  { id: 'accuracy', title: 'Độ chính xác cao', description: 'Tốn pin hơn' },
];

export default function GpsSettings({
  autoPlay,
  onAutoPlayChange,
  triggerRadius,
  onRadiusChange,
  locationMode,
  onLocationModeChange,
}: {
  autoPlay: boolean;
  onAutoPlayChange: (value: boolean) => void;
  triggerRadius: number;
  onRadiusChange: (value: number) => void;
  locationMode: LocationMode;
  onLocationModeChange: (mode: LocationMode) => void;
}) {
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const radiusPanResponder = React.useMemo(() => {
    const dragState = { startPosition: 0 };
    const updateRadius = (position: number) => {
      if (sliderWidth <= 0) return;
      const percentage = Math.min(1, Math.max(0, position / sliderWidth));
      onRadiusChange(Math.round(MIN_RADIUS + percentage * (MAX_RADIUS - MIN_RADIUS)));
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        dragState.startPosition = event.nativeEvent.locationX;
        updateRadius(dragState.startPosition);
      },
      onPanResponderMove: (_, gestureState) =>
        updateRadius(dragState.startPosition + gestureState.dx),
    });
  }, [onRadiusChange, sliderWidth]);

  const radiusPercentage = ((triggerRadius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100;
  const innerRadiusSize = 16 + (radiusPercentage / 100) * 46;

  return (
    <View className="mb-4 rounded-2xl bg-white shadow-sm">
      <View className="p-[14px]">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[12px] font-semibold text-[#102d4f]">
              Tự động phát khi đến gần
            </Text>
            <Text className="mt-[3px] text-[10px] text-[#8796ad]">
              Phát thuyết minh khi vào vùng kích hoạt
            </Text>
          </View>
          <SettingsToggle value={autoPlay} onChange={onAutoPlayChange} />
        </View>

        <View className="mt-[18px]">
          <View className="flex-row items-center justify-between">
            <Text className="text-[12px] font-semibold text-[#102d4f]">Bán kính kích hoạt</Text>
            <Text className="text-[12px] font-bold text-[#0aa99d]">{triggerRadius} m</Text>
          </View>
          <View
            {...radiusPanResponder.panHandlers}
            accessibilityLabel="Bán kính kích hoạt"
            accessibilityRole="adjustable"
            onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
            className="h-[30px] justify-center"
          >
            <View className="h-[3px] bg-[#b9f1ec]">
              <View className="h-[3px] bg-[#0aa99d]" style={{ width: `${radiusPercentage}%` }} />
              <View
                className="absolute top-[-5px] h-[14px] w-[14px] rounded-[8px] bg-[#0aa99d]"
                style={{ left: `${radiusPercentage}%`, marginLeft: -7 }}
              />
            </View>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[9px] text-[#8796ad]">20 m</Text>
            <Text className="text-[9px] text-[#8796ad]">500 m</Text>
          </View>
        </View>

        <View className="mt-3 items-center justify-center">
          <View className="h-16 w-16 items-center justify-center rounded-full border border-[#8eece5]">
            <View
              className="items-center justify-center rounded-full border border-[#ffb45c] bg-[#fff1dc]"
              style={{ height: innerRadiusSize, width: innerRadiusSize }}
            >
              <View className="h-2 w-2 rounded-full bg-[#ff9f32]" />
            </View>
          </View>
          <Text className="mt-[10px] text-[9px] text-[#8796ad]">
            Bán kính hoạt động (không phải độ chính xác GPS)
          </Text>
        </View>
      </View>

      <View className="border-t border-[#f0f2f5] p-[14px]">
        <Text className="mb-2 text-[12px] font-semibold text-[#102d4f]">
          Chế độ cập nhật vị trí
        </Text>
        <View className="gap-[6px]">
          {locationModes.map((mode) => {
            const selected = mode.id === locationMode;
            return (
              <Pressable
                key={mode.id}
                onPress={() => onLocationModeChange(mode.id)}
                className={`min-h-[44px] rounded-[10px] border px-[11px] py-[7px] ${
                  selected ? 'border-[#0aa99d] bg-[#effcfb]' : 'border-[#edf0f4] bg-[#f8fafc]'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-[11px] font-semibold text-[#102d4f]">{mode.title}</Text>
                    <Text className="mt-0.5 text-[9px] text-[#8796ad]">{mode.description}</Text>
                  </View>
                  {selected && <IconCheck size={14} color="#0aa99d" />}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text className="mt-2 text-[9px] leading-[13px] text-[#8796ad]">
          Ứng dụng không thể cải thiện độ chính xác GPS vượt quá khả năng phần cứng của thiết bị.
        </Text>
      </View>
    </View>
  );
}
