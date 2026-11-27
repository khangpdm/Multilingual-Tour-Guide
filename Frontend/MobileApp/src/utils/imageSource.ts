import { ImageSourcePropType } from 'react-native';

export const DEFAULT_POI_IMAGE: ImageSourcePropType = require('../../assets/images/default-poi.avif');

export function getImageSource(
  uri?: string | null,
  fallback: ImageSourcePropType = DEFAULT_POI_IMAGE
): ImageSourcePropType {
  if (typeof uri === 'string' && uri.trim().length > 0) {
    return { uri: uri.trim() };
  }
  return fallback;
}
