import { useApp } from '@/store/AppContext';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';

const LOCATION_TIME_INTERVAL = 3000;
const LOCATION_DISTANCE_INTERVAL = 5;

function getLocationAccuracy(mode: 'battery' | 'balanced' | 'accuracy') {
  switch (mode) {
    case 'battery':
      return Location.Accuracy.Low;
    case 'accuracy':
      return Location.Accuracy.High;
    case 'balanced':
    default:
      return Location.Accuracy.Balanced;
  }
}

export function LocationTracker() {
  const {
    isDemoMode,
    updateGpsLocation,
    locationMode,
    setGpsPermissionStatus,
    requestGpsPermission,
  } = useApp();

  useEffect(() => {
    let disposed = false;
    let appIsActive = AppState.currentState === 'active' || AppState.currentState === null;

    let subscription: Location.LocationSubscription | null = null;
    let startPromise: Promise<void> | null = null;

    const stopTracking = () => {
      subscription?.remove();
      subscription = null;
    };

    const reconcileTracking = async (): Promise<void> => {
      if (disposed || !appIsActive || isDemoMode) {
        stopTracking();
        return;
      }

      if (subscription) return;

      // Chống khởi tạo GPS nhiều lần trong cùng một effect.
      if (startPromise) return startPromise;

      const currentStartPromise = (async () => {
        try {
          let permission = await Location.getForegroundPermissionsAsync();

          if (disposed || !appIsActive || isDemoMode) return;

          setGpsPermissionStatus(permission.status);

          // Chỉ tự xin quyền khi chưa từng xác định quyền.
          if (permission.status === 'undetermined') {
            const granted = await requestGpsPermission();

            if (!granted || disposed || !appIsActive || isDemoMode) {
              stopTracking();
              return;
            }

            permission = await Location.getForegroundPermissionsAsync();
          }

          if (permission.status !== 'granted') {
            setGpsPermissionStatus(permission.status);
            stopTracking();
            return;
          }

          setGpsPermissionStatus('granted');

          const servicesEnabled = await Location.hasServicesEnabledAsync();

          if (disposed || !appIsActive || isDemoMode) return;

          if (!servicesEnabled) {
            stopTracking();
            return;
          }

          const newSubscription = await Location.watchPositionAsync(
            {
              accuracy: getLocationAccuracy(locationMode),
              timeInterval: LOCATION_TIME_INTERVAL,
              distanceInterval: LOCATION_DISTANCE_INTERVAL,
            },
            (location) => {
              if (disposed || !appIsActive || isDemoMode) return;

              updateGpsLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy,
                timestamp: location.timestamp,
              });
            },
            (reason) => {
              console.warn('[LocationTracker] Location watcher error:', reason);
            }
          );

          // Không giữ subscription nếu effect đã bị hủy
          // hoặc ứng dụng không còn ở foreground.
          if (disposed || !appIsActive || isDemoMode) {
            newSubscription.remove();
            return;
          }

          subscription = newSubscription;
        } catch (error) {
          console.warn('[LocationTracker] Unable to track location:', error);
          stopTracking();
        }
      })();

      startPromise = currentStartPromise;

      try {
        await currentStartPromise;
      } finally {
        if (startPromise === currentStartPromise) {
          startPromise = null;
        }
      }
    };

    const handleAppStateChange = (state: string) => {
      appIsActive = state === 'active';

      if (appIsActive) {
        void reconcileTracking();
      } else {
        stopTracking();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    if (appIsActive && !isDemoMode) {
      void reconcileTracking();
    }

    return () => {
      disposed = true;
      appStateSubscription.remove();
      stopTracking();
    };
  }, [isDemoMode, locationMode, updateGpsLocation, setGpsPermissionStatus, requestGpsPermission]);

  return null;
}
