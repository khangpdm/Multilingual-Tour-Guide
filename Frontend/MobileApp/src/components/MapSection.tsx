import Mapbox, { Camera, LocationPuck, MapView, UserLocation } from '@rnmapbox/maps';
import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
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
