import { httpGet } from './httpClient';

export interface POI {
  id: string;
  name: Record<string, string | null> | string;
  description: Record<string, string | null> | string;
  ttsScript: Record<string, string | null>;
  category: string;
  address: string;
  lat: number;
  lng: number;
  coverImage: string;
  mapLink?: string;
}

export async function fetchPOIs(): Promise<POI[]> {
  try {
    const data = await httpGet('/poi/load-all');

    const rawPois = data.updated_pois || data.pois || [];

    return rawPois.map((item: any) => {
      const nameMap: Record<string, string> = {};
      const descMap: Record<string, string> = {};
      let defaultAddress = '';

      if (item.content) {
        Object.keys(item.content).forEach((lang) => {
          nameMap[lang] = item.content[lang].name;
          descMap[lang] = item.content[lang].text;
          if (lang === 'vi' || !defaultAddress) {
            defaultAddress = item.content[lang].address;
          }
        });
      }

      return {
        id: item.poi_id,
        name: nameMap,
        description: descMap,
        ttsScript: descMap,
        category: item.category || 'landmark',
        address: defaultAddress,
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

export async function fetchPOIDetail(poiId: string): Promise<POI | null> {
  try {
    const data = await httpGet(`/pois/${poiId}`);
    return data.poi || null;
  } catch (error) {
    console.warn(`[PoiService] Không thể tải chi tiết POI ${poiId}:`, error);
    return null;
  }
}
