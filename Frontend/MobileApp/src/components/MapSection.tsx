import Mapbox from '@rnmapbox/maps';
import React from 'react';
import { View } from 'react-native';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

Mapbox.setAccessToken(MAPBOX_TOKEN ?? '');

const Mapsection = () => {
  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView style={{ flex: 1 }}>
        <Mapbox.Camera zoomLevel={14} centerCoordinate={[106.660172, 10.762622]} />
      </Mapbox.MapView>
    </View>
  );
};

export default Mapsection;
