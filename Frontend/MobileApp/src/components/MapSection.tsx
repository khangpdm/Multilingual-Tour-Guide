import { POIS } from '@/data/pois';
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

const Mapsection = () => {
  const cameraRef = useRef<Camera>(null);
  const [hasFollowed, setHasFollowed] = useState(false);

  const [userCoordinates, setUserCoordinates] = useState<[number, number] | null>(null);

  useEffect(() => {
    Mapbox.requestAndroidLocationPermissions();
  }, []);

  const poiGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
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
          name: poi.name.vi,
          category: poi.category,
        },
      })),
    };
  }, []);

  const handleUserLocationUpdate = (location: Mapbox.Location) => {
    if (location?.coords) {
      const { longitude, latitude } = location.coords;
      const coords: [number, number] = [longitude, latitude];

      setUserCoordinates(coords);

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

  return (
    <View className="relative flex-1 w-full h-full">
      <MapView
        style={{ flex: 1 }}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
      >
        <Camera ref={cameraRef} zoomLevel={14} />
        <UserLocation onUpdate={handleUserLocationUpdate} />
        <LocationPuck puckBearingEnabled puckBearing="heading" pulsing={{ isEnabled: true }} />

        <Images images={{ pin }} />

        <ShapeSource
          id="poisSource"
          shape={poiGeoJSON}
          cluster
          // onPress={(e) => console.log(JSON.stringify(e, null, 2))}
        >
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

              // textField: ['get', 'name'],
              // textSize: 11,
              // textAnchor: 'top',
              // textOffset: [0, 1],
              // textColor: '#1F2937',
              // textHaloColor: '#FFFFFF',
              // textHaloWidth: 1.5,
              // textAllowOverlap: true,
            }}
          ></SymbolLayer>
        </ShapeSource>
      </MapView>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleReCenter}
        className="absolute bottom-6 right-5 bg-white px-4 py-3 rounded-full shadow-lg border border-gray-100
        items-center justify-center active:bg-gray-100"
      >
        <Text className="font-bold text-teal-600">
          <IconTarget />
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default Mapsection;
