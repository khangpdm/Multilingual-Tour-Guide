import { httpGet } from './httpClient';

export interface POI {
  id: string;
  name: Record<string, string | null> | string;
  description: Record<string, string | null> | string;
  ttsScript: Record<string, string | null>;
  category: string;
  address: Record<string, string | null> | string;
  lat: number;
  lng: number;
  coverImage: string;
  mapLink?: string;
}

export async function fetchPOIs(): Promise<POI[]> {
  try {
    const data = await httpGet<any>('/poi/load-all');

    const rawPois = data.updated_pois || data.pois || [];

    return rawPois.map((item: any) => {
      const nameMap: Record<string, string> = {};
      const descMap: Record<string, string> = {};
      const addressMap: Record<string, string | null> = {};

      if (item.content) {
        Object.keys(item.content).forEach((lang) => {
          nameMap[lang] = item.content[lang].name;
          descMap[lang] = item.content[lang].text;
          addressMap[lang] = item.content[lang].address || null;
        });
      }

      return {
        id: item.poi_id,
        name: nameMap,
        description: descMap,
        ttsScript: descMap,
        category: normalizeCategory(item.category),
        address: addressMap,
        lat: item.location?.lat || 0,
        lng: item.location?.lng || 0,
        coverImage:
          item.images?.[0] || 'https://images.unsplash.com/photo-1583417319070-4a69db38a482',
      };
    });
  } catch (error) {
    console.warn('[PoiService] Không thể tải POI từ server, dùng dữ liệu local:', error);
    return [];
  }
}

const CATEGORY_ALIASES: Record<string, string> = {
  'Di tích': 'landmark',
  historical_site: 'landmark',
  landmark: 'landmark',
  'Bảo tàng': 'museum',
  museum: 'museum',
  'Tôn giáo': 'religious',
  religious: 'religious',
  'Kiến trúc': 'architecture',
  architecture: 'architecture',
  'Công viên': 'park',
  park: 'park',
  'Ẩm thực': 'food',
  food: 'food',
};

function normalizeCategory(value?: string): string {
  return CATEGORY_ALIASES[value || ''] || 'landmark';
}

export async function fetchPOIDetail(poiId: string): Promise<POI | null> {
  try {
    const data = await httpGet<{ poi?: POI }>(`/pois/${poiId}`);
    const poi = data.poi;
    return poi ? { ...poi, category: normalizeCategory(poi.category) } : null;
  } catch (error) {
    console.warn(`[PoiService] Không thể tải chi tiết POI ${poiId}:`, error);
    return null;
  }
}
