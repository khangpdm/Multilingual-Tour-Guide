import { httpGet } from './httpClient';

export interface LanguageItem {
  code: string;
  name: string;
  flag: string;
}

export async function fetchActiveLanguages(): Promise<LanguageItem[]> {
  try {
    const data = await httpGet('/languages');
    return data.languages || [];
  } catch (error) {
    console.warn(
      '[LanguageService] Không thể tải danh sách ngôn ngữ từ server, dùng dữ liệu dự phòng:',
      error
    );

    return [
      { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' },
      { code: 'ja', name: '日本語', flag: '🇯🇵' },
      { code: 'ko', name: '한국어', flag: '🇰🇷' },
      { code: 'zh', name: '中文', flag: '🇨🇳' },
    ];
  }
}
