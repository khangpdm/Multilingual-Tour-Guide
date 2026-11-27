import { useApp } from '@/store/AppContext';
import { haversineDistance } from '@/data/pois';
import type { POI } from '@/services/poiService';
import { useEffect, useRef } from 'react';

const GPS_MAX_AGE_MS = 10_000;
const GPS_MAX_ACCURACY_M = 50;
const REQUIRED_SAMPLES = 2;

interface GeofenceState {
  isInside: boolean;
  enterSamples: number;
  exitSamples: number;
}

export function GeofenceEngine() {
  const { gpsLocation, pois, isDemoMode, autoPlay, isPlaying, isPlaybackBusy, startPlayback } =
    useApp();

  const statesRef = useRef<Map<string, GeofenceState>>(new Map());
  const lastProcessedTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    // Không cho phép tọa độ demo kích hoạt geofence.
    if (isDemoMode) {
      statesRef.current.clear();
      lastProcessedTimestampRef.current = null;
      return;
    }

    if (!gpsLocation) return;

    const now = Date.now();
    const gpsAge = now - gpsLocation.timestamp;

    // Bỏ qua GPS quá cũ hoặc timestamp không hợp lệ.
    if (!Number.isFinite(gpsLocation.timestamp) || gpsAge < 0 || gpsAge > GPS_MAX_AGE_MS) {
      return;
    }

    // Bỏ qua GPS có độ chính xác quá thấp.
    if (
      gpsLocation.accuracy !== null &&
      (!Number.isFinite(gpsLocation.accuracy) ||
        gpsLocation.accuracy < 0 ||
        gpsLocation.accuracy > GPS_MAX_ACCURACY_M)
    ) {
      return;
    }

    // Không xử lý lại cùng một bản ghi GPS.
    if (
      lastProcessedTimestampRef.current !== null &&
      gpsLocation.timestamp <= lastProcessedTimestampRef.current
    ) {
      return;
    }

    lastProcessedTimestampRef.current = gpsLocation.timestamp;

    const validPOIs = pois.filter((poi: POI) => {
      return (
        Number.isFinite(poi.lat) &&
        Number.isFinite(poi.lng) &&
        poi.lat >= -90 &&
        poi.lat <= 90 &&
        poi.lng >= -180 &&
        poi.lng <= 180 &&
        !(poi.lat === 0 && poi.lng === 0) &&
        Number.isFinite(poi.geofence_radius_m) &&
        poi.geofence_radius_m > 0
      );
    });

    // Xóa trạng thái của POI không còn trong danh sách hiện tại.
    const currentIds = new Set(validPOIs.map((poi) => poi.id));

    for (const poiId of statesRef.current.keys()) {
      if (!currentIds.has(poiId)) {
        statesRef.current.delete(poiId);
      }
    }

    const enteredPOIs: { poi: POI; distance: number }[] = [];

    for (const poi of validPOIs) {
      const distance = haversineDistance(
        gpsLocation.latitude,
        gpsLocation.longitude,
        poi.lat,
        poi.lng
      );

      const enterRadius = poi.geofence_radius_m;

      // Vùng thoát lớn hơn vùng vào để hạn chế GPS dao động.
      const exitRadius = enterRadius + Math.max(15, enterRadius * 0.2);

      const state = statesRef.current.get(poi.id) ?? {
        isInside: false,
        enterSamples: 0,
        exitSamples: 0,
      };

      if (!state.isInside) {
        if (distance <= enterRadius) {
          state.enterSamples += 1;

          if (state.enterSamples >= REQUIRED_SAMPLES) {
            state.isInside = true;
            state.enterSamples = 0;
            state.exitSamples = 0;

            console.info('[Geofence] ENTER', {
              poiId: poi.id,
              distanceM: Math.round(distance),
              radiusM: enterRadius,
            });

            enteredPOIs.push({ poi, distance });
          }
        } else {
          state.enterSamples = 0;
        }
      } else {
        if (distance > exitRadius) {
          state.exitSamples += 1;

          if (state.exitSamples >= REQUIRED_SAMPLES) {
            state.isInside = false;
            state.enterSamples = 0;
            state.exitSamples = 0;

            console.info('[Geofence] EXIT', {
              poiId: poi.id,
              distanceM: Math.round(distance),
              exitRadiusM: Math.round(exitRadius),
            });
          }
        } else {
          state.exitSamples = 0;
        }
      }

      statesRef.current.set(poi.id, state);
    }

    if (autoPlay && !isPlaying && !isPlaybackBusy && enteredPOIs.length > 0) {
      // Nếu nhiều POI cùng ENTER, chọn POI gần nhất.
      enteredPOIs.sort((a, b) => a.distance - b.distance);

      const nearestPOI = enteredPOIs[0].poi;

      console.info('[Geofence] AUTO_PLAY', {
        poiId: nearestPOI.id,
        distanceM: Math.round(enteredPOIs[0].distance),
      });

      void startPlayback(nearestPOI.id);
    }
  }, [gpsLocation, pois, isDemoMode, autoPlay, isPlaying, isPlaybackBusy, startPlayback]);

  return null;
}
