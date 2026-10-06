import { POIS } from '@/data/pois';
import { useApp } from '@/store/AppContext';
import { CategoryOption } from '@/types/map';
import Mapbox, {
  Camera,
  CircleLayer,
  Images,
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

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

const CATEGORIES: CategoryOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'Bảo tàng', label: 'Bảo tàng' },
  { id: 'Tôn giáo', label: 'Tôn giáo' },
  { id: 'Công viên', label: 'Công viên' },
];

interface MapsectionProps {
  onMapTouch?: () => void;
}

const Mapsection: React.FC<MapsectionProps> = ({ onMapTouch }) => {
  const cameraRef = useRef<Camera>(null);

  const {
    language,
    selectedMapPOIId,
    setSelectedMapPOIId,
    selectedCategory,
    setSelectedCategory,
    setUserLocation,
  } = useApp();

  const [hasFollowed, setHasFollowed] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<[number, number] | null>(null);

  useEffect(() => {
    Mapbox.requestAndroidLocationPermissions();
  }, []);

  const poiGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    const filteredPois =
      selectedCategory === 'all' ? POIS : POIS.filter((p) => p.category === selectedCategory);

    return {
      type: 'FeatureCollection',
      features: POIS.map((poi) => ({
        type: 'Feature',
        id: poi.id,
        geometry: {
          type: 'Point',
          coordinates: [poi.lng, poi.lat],
        },
        properties: {
          id: poi.id,
          name: typeof poi.name === 'object' ? poi.name[language] || poi.name.vi : poi.name,
          category: poi.category,
        },
      })),
    };
  }, [selectedCategory, language]);

  const handleUserLocationUpdate = (location: Mapbox.Location) => {
    if (location?.coords) {
      const { longitude, latitude } = location.coords;
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
    const feature = e.features?.[0] as GeoJSON.Feature;
    if (!feature) return;

    const geometry = feature.geometry as GeoJSON.Point;
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
      setSelectedMapPOIId(props.id);
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: 16,
        animationDuration: 1000,
      });
    }
  };

  return (
    <View className="relative flex-1 w-full h-full">
      <MapView
        style={{ flex: 1 }}
        styleURL="mapbox://styles/phamdangminhkhang/cmummdaw2002s01r1a6lqc2en"
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
        <Camera ref={cameraRef} zoomLevel={14} />
        <UserLocation onUpdate={handleUserLocationUpdate} />
        <LocationPuck puckBearingEnabled puckBearing="heading" pulsing={{ isEnabled: true }} />

        <Images images={{ pin }} />

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
          ></SymbolLayer>
        </ShapeSource>
      </MapView>

      {/* NÚT RE-CENTER */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleReCenter}
        className="absolute top-3 right-5 bg-white px-4 py-3 rounded-full shadow-lg border border-gray-100
        items-center justify-center active:bg-gray-100"
      >
        <Text className="font-bold text-teal-600">
          <IconTarget color="#00897B" />
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default Mapsection;
