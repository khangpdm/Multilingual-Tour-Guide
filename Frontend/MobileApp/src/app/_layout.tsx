import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocationTracker } from '@/components/LocationTracker';
import { AppProvider } from '@/store/AppContext';
import { DevicePresence } from '@/components/DevicePresence';
import { GeofenceEngine } from '@/components/GeofenceEngine';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <DevicePresence />
        <LocationTracker />
        <GeofenceEngine />

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="poi/[id]"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
            }}
          />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
