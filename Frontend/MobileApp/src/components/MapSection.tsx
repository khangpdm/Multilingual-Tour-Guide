import { createGeofencePolygon } from '@/data/pois';
import { useApp } from '@/store/AppContext';
import Mapbox, {
  Camera,
  CircleLayer,
  FillLayer,
  Images,
  LineLayer,
  LocationPuck,
  MapView,
  ShapeSource,
  SymbolLayer,
  UserLocation,
} from '@rnmapbox/maps';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import pin from '../../assets/images/pin.png';
import { IconTarget } from './Icons';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim();
const HAS_MAPBOX_TOKEN = Boolean(MAPBOX_TOKEN?.startsWith('pk.'));

interface MapsectionProps {
  onMapTouch?: () => void;
}

const Mapsection: React.FC<MapsectionProps> = ({ onMapTouch }) => {
  const cameraRef = useRef<Camera>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const {
    language,
    setSelectedMapPOIId,
    selectedCategory,
    setUserLocation,
    hasFollowed,
    setHasFollowed,
    userCoordinates,
    setUserCoordinates,
    pois,
  } = useApp();

  useEffect(() => {
    if (!HAS_MAPBOX_TOKEN) return;
    let active = true;

    Mapbox.setAccessToken(MAPBOX_TOKEN!)
      .then(() => {
        if (active) setMapReady(true);
      })
      .catch(() => {
        if (active) setMapFailed(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mapReady) {
      void Mapbox.requestAndroidLocationPermissions();
    }
  }, [mapReady]);

  const filteredPois = useMemo(() => {
    return selectedCategory === 'all' ? pois : pois.filter((p) => p.category === selectedCategory);
  }, [selectedCategory, pois]);

  const poiGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: filteredPois.map((poi) => ({
        type: 'Feature',
        id: poi.id,
        geometry: {
          type: 'Point',
          coordinates: [Number(poi.lng) || 0, Number(poi.lat) || 0],
        },
        properties: {
          id: poi.id,
          name: typeof poi.name === 'object' ? poi.name[language] || poi.name.vi || '' : poi.name,
          category: poi.category,
        },
      })),
    };
  }, [filteredPois, language]);

  const geofenceGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: filteredPois.flatMap((poi) => {
        const lat = Number(poi.lat);
        const lng = Number(poi.lng);
        const radius = poi.geofence_radius_m;
        const id = poi.id;

        if (
          poi.lat == null ||
          poi.lng == null ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          return [];
        }

        const ring = createGeofencePolygon(lng, lat, radius);

        if (ring.length < 4) return [];

        return [
          {
            type: 'Feature' as const,
            id: `geofence-${id}`,
            properties: {
              id,
              radius,
            },
            geometry: {
              type: 'Polygon' as const,
              coordinates: [ring],
            },
          },
        ];
      }),
    };
  }, [filteredPois]);

  const handleUserLocationUpdate = (location: Mapbox.Location) => {
    if (!location?.coords) return;

    const { longitude, latitude } = location.coords;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;

    const coords: [number, number] = [longitude, latitude];
    setUserCoordinates(coords);
    setUserLocation(latitude, longitude);

    if (!hasFollowed) {
      cameraRef.current?.setCamera({
        centerCoordinate: coords,
        zoomLevel: 15,
        animationDuration: 1000,
      });
      setHasFollowed(true);
    }
  };

  const handleReCenter = () => {
    if (userCoordinates) {
      cameraRef.current?.setCamera({
        centerCoordinate: userCoordinates,
        zoomLevel: 16,
        animationDuration: 1000,
      });
      setHasFollowed(true);
    }
  };

  const handleShapeSourcePress = (e: any) => {
    const feature = e.features?.[0] as GeoJSON.Feature | undefined;
    if (!feature) return;

    const geometry = feature.geometry as GeoJSON.Point;
    if (!Array.isArray(geometry?.coordinates) || geometry.coordinates.length < 2) return;

    const [lng, lat] = geometry.coordinates;
    const props = feature.properties;

    if (props?.cluster) {
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: 14,
        animationDuration: 1000,
      });
      return;
    }

    if (props?.id) {
      setSelectedMapPOIId(String(props.id));
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: 16,
        animationDuration: 1000,
      });
    }
  };

  if (!mapReady) {
    const unavailable = !HAS_MAPBOX_TOKEN || mapFailed;
    return (
      <View className="h-full w-full flex-1 items-center justify-center bg-slate-100 px-8">
        <Text className="text-center text-lg font-bold text-slate-700">
          {language === 'vi'
            ? unavailable
              ? 'Bản đồ chưa sẵn sàng'
              : 'Đang tải bản đồ...'
            : unavailable
              ? 'Map unavailable'
              : 'Loading map...'}
        </Text>
        {unavailable && (
          <Text className="mt-3 text-center text-sm text-slate-500">
            {language === 'vi'
              ? 'Bạn vẫn có thể xem địa điểm, quét QR và nghe thuyết minh. Bản đồ cần được cấu hình trước khi sử dụng.'
              : 'You can still browse places, scan QR codes and listen to narration. The map needs to be configured before use.'}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className="relative h-full w-full flex-1">
      <MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        onPress={() => {
          onMapTouch?.();
        }}
        onTouchMove={() => {
          onMapTouch?.();
        }}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={14}
          defaultSettings={
            userCoordinates ? { centerCoordinate: userCoordinates, zoomLevel: 14 } : undefined
          }
        />
        <UserLocation onUpdate={handleUserLocationUpdate} />
        <LocationPuck puckBearingEnabled puckBearing="heading" pulsing={{ isEnabled: true }} />

        <Images images={{ pin }} />

        <ShapeSource id="geofenceSource" shape={geofenceGeoJSON}>
          <FillLayer id="geofenceFill" style={{ fillColor: '#14B8A6', fillOpacity: 0.15 }} />
          <LineLayer
            id="geofenceBorder"
            style={{ lineColor: '#0D9488', lineWidth: 2, lineOpacity: 0.7 }}
          />
        </ShapeSource>

        <ShapeSource id="poisSource" shape={poiGeoJSON} cluster onPress={handleShapeSourcePress}>
          <CircleLayer
            id="clusters"
            filter={['has', 'point_count']}
            style={{
              circlePitchAlignment: 'map',
              circleColor: '#00d4b0',
              circleRadius: 20,
              circleOpacity: 1,
              circleStrokeWidth: 2,
              circleStrokeColor: 'white',
            }}
          />

          <SymbolLayer
            id="clusters-count"
            style={{
              textField: ['get', 'point_count'],
              textSize: 18,
              textColor: 'white',
              textPitchAlignment: 'map',
            }}
          />

          <SymbolLayer
            id="poisSymbols"
            filter={['!', ['has', 'point_count']]}
            style={{
              iconImage: 'pin',
              iconSize: 0.1,
              iconAllowOverlap: true,
              iconAnchor: 'bottom',
              textField: ['get', 'name'],
              textSize: 12,
              textAnchor: 'top',
              textOffset: [0, 1],
              textColor: '#1F2937',
              textHaloColor: '#FFFFFF',
              textHaloWidth: 1.5,
              textAllowOverlap: true,
            }}
          />
        </ShapeSource>
      </MapView>

      {/* NÚT RE-CENTER */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleReCenter}
        className="absolute right-5 top-3 items-center justify-center rounded-full border border-gray-100 bg-white px-4 py-3 shadow-lg active:bg-gray-100"
      >
        <IconTarget color="#00897B" />
      </TouchableOpacity>
    </View>
  );
};

export default Mapsection;
