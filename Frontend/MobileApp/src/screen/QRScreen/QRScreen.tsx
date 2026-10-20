import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';

import { useApp } from '@/store/AppContext';
import { QR_POI_MAP, POIS } from '@/data/pois';
import { IconFlash, IconClose } from '@/components/Icons';

type ScanState = 'idle' | 'scanning' | 'success' | 'invalid' | 'missing';

export default function QRScanScreen() {
  const { openPOI, language } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [state, setState] = useState<ScanState>('idle');
  const [scannedLabel, setScannedLabel] = useState('');

  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const resetScanner = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    lockedRef.current = false;
    setState('idle');
    setScannedLabel('');
  }, []);

  const handleBarcodeScanned = useCallback(
    ({ data, type }: BarcodeScanningResult) => {
      if (type !== 'qr' || lockedRef.current) return;

      lockedRef.current = true;
      setState('scanning');

      const poiId = QR_POI_MAP[data];

      if (!poiId) {
        setState('invalid');
        return;
      }

      const poi = POIS.find((item) => item.id === poiId);

      if (!poi) {
        setState('missing');
        return;
      }

      setScannedLabel(poi.name[language] ?? data);
      setState('success');

      timerRef.current = setTimeout(() => {
        openPOI(poiId);
        timerRef.current = null;
        lockedRef.current = false;
        setState('idle');
        setScannedLabel('');
      }, 700);
    },
    [openPOI]
  );

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-950 px-6">
        <Text className="text-center text-sm text-white">Đang kiểm tra quyền camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-950 px-7">
        <Text className="mb-3 text-center text-xl font-bold text-white">
          Cần quyền truy cập camera
        </Text>

        <Text className="mb-6 text-center text-sm leading-6 text-gray-300">
          Cho phép ứng dụng sử dụng camera để quét mã QR địa điểm du lịch.
        </Text>

        <Pressable
          onPress={requestPermission}
          className="rounded-xl bg-teal-600 px-6 py-3 active:bg-teal-700"
        >
          <Text className="font-bold text-white">Cấp quyền camera</Text>
        </Pressable>
      </View>
    );
  }

  const isError = state === 'invalid' || state === 'missing';

  const statusMessage: Record<ScanState, string> = {
    idle: 'Đưa mã QR của địa điểm vào trong khung',
    scanning: 'Đang xử lý mã QR...',
    success: 'Tìm thấy địa điểm! Đang mở...',
    invalid: 'Mã QR không hợp lệ hoặc chưa được hỗ trợ',
    missing: 'Không tìm thấy địa điểm tương ứng',
  };

  const frameColor =
    state === 'success' ? 'border-green-500' : isError ? 'border-red-500' : 'border-teal-500';

  const corners = [
    {
      position: 'left-0 top-0',
      border: 'border-l-4 border-t-4 rounded-tl',
    },
    {
      position: 'right-0 top-0',
      border: 'border-r-4 border-t-4 rounded-tr',
    },
    {
      position: 'bottom-0 left-0',
      border: 'border-b-4 border-l-4 rounded-bl',
    },
    {
      position: 'bottom-0 right-0',
      border: 'border-b-4 border-r-4 rounded-br',
    },
  ];

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Camera thật */}
      <View className="relative flex-1 overflow-hidden bg-gray-950">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={flash}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={state === 'idle' ? handleBarcodeScanned : undefined}
        />

        {/* Lớp phủ nhẹ trên camera */}
        <View pointerEvents="none" className="absolute inset-0 bg-black/20" />

        <View className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-2">
          <Text className="text-[10px] font-bold tracking-wide text-white">QUÉT QR ĐỊA ĐIỂM</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={flash ? 'Tắt đèn flash' : 'Bật đèn flash'}
          onPress={() => setFlash((value) => !value)}
          className={`absolute right-4 top-4 h-11 w-11 items-center justify-center rounded-full ${
            flash ? 'bg-yellow-400' : 'bg-white/20'
          }`}
        >
          <IconFlash size={20} />
        </Pressable>

        {/* Khung nhận diện */}
        <View className="absolute inset-0 items-center justify-center px-6">
          <View className="relative h-56 w-56 items-center justify-center">
            {corners.map((corner, index) => (
              <View
                key={index}
                className={`absolute h-10 w-10 ${corner.position} ${corner.border} ${frameColor}`}
              />
            ))}

            {state === 'scanning' && (
              <View className="h-12 w-12 items-center justify-center rounded-full border-4 border-teal-400">
                <View className="h-6 w-6 rounded-full bg-teal-400/30" />
              </View>
            )}

            {state === 'success' && (
              <View className="h-14 w-14 items-center justify-center rounded-full bg-green-500">
                <Text className="text-3xl font-bold text-white">✓</Text>
              </View>
            )}

            {isError && (
              <View className="h-14 w-14 items-center justify-center rounded-full bg-red-500">
                <Text className="text-3xl font-bold text-white">!</Text>
              </View>
            )}
          </View>

          <Text
            className={`mt-5 px-5 text-center text-sm leading-6 ${
              state === 'success'
                ? 'font-semibold text-green-300'
                : isError
                  ? 'text-red-300'
                  : 'text-white'
            }`}
          >
            {statusMessage[state]}
          </Text>

          {state === 'success' && (
            <Text className="mt-2 text-center text-sm text-white">{scannedLabel}</Text>
          )}

          {isError && (
            <Pressable
              onPress={resetScanner}
              className="mt-4 flex-row items-center gap-2 rounded-full bg-white/15 px-5 py-3"
            >
              <IconClose size={16} />
              <Text className="font-semibold text-white">Quét lại</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Hướng dẫn */}
      <View className="bg-gray-900 px-5 pb-7 pt-5">
        <Text className="mb-3 text-xs font-bold tracking-widest text-gray-400">
          HƯỚNG DẪN QUÉT MÃ
        </Text>

        <View className="mb-4 flex-row items-start gap-3">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-teal-900">
            <Text className="text-sm font-bold text-teal-300">1</Text>
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-sm font-semibold text-white">Đưa camera về phía mã QR</Text>
            <Text className="text-xs leading-5 text-gray-400">
              Giữ mã QR trọn trong khung và đảm bảo đủ ánh sáng.
            </Text>
          </View>
        </View>

        <View className="flex-row items-start gap-3">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-teal-900">
            <Text className="text-sm font-bold text-teal-300">2</Text>
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-sm font-semibold text-white">Mở thuyết minh địa điểm</Text>
            <Text className="text-xs leading-5 text-gray-400">
              Ứng dụng tự nhận diện mã và mở địa điểm tương ứng.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
