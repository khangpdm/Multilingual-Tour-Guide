import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { httpPost } from '@/services/httpClient';

let installationPromise: Promise<string> | undefined;

function installationId(): Promise<string> {
  installationPromise ??= (async () => {
    const stored = await AsyncStorage.getItem('mobile-installation-id');
    if (stored) return stored;
    const created = Crypto.randomUUID();
    await AsyncStorage.setItem('mobile-installation-id', created);
    return created;
  })().catch((error) => {
    installationPromise = undefined;
    throw error;
  });
  return installationPromise;
}

export function DevicePresence() {
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const sendHeartbeat = async () => {
      if (disposed || pending || AppState.currentState !== 'active') return;
      pending = true;
      try {
        const identifier = await installationId();
        if (!disposed && AppState.currentState === 'active') {
          await httpPost('/mobile/heartbeat', { installation_id: identifier });
        }
      } catch {
        return;
      } finally {
        pending = false;
      }
    };
    void sendHeartbeat();
    const timer = setInterval(() => void sendHeartbeat(), 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sendHeartbeat();
    });
    return () => {
      disposed = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return null;
}
