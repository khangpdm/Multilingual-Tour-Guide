import { httpGet } from './httpClient';

export interface LanguageItem {
  code: string;
  name: string;
  flag: string;
}

export async function fetchActiveLanguages(): Promise<LanguageItem[]> {
  try {
    const data = await httpGet<{ languages?: (LanguageItem & { native_name?: string })[] }>(
      '/languages'
    );
    return (data.languages || []).map((item) => ({
      code: item.code,
      name: item.native_name || item.name,
      flag: item.flag || '🌐',
    }));
  } catch (error) {
    console.warn(
      '[LanguageService] Không thể tải danh sách ngôn ngữ từ server, dùng dữ liệu dự phòng:',
      error
    );

    return [
      { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
      { code: 'en', name: 'English', flag: '🇺🇸' },
    ];
  }
}
