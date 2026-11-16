import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import vi from './locales/vi.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';

const LANGUAGE_KEY = 'app_language';

const resources = {
  vi: { translation: vi },
  en: { translation: en },
  fr: { translation: fr },
  ja: { translation: ja },
  ko: { translation: ko },
  zh: { translation: zh },
};

const supportedLanguages = ['vi', 'en', 'fr', 'ja', 'ko', 'zh'];

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? flattenKeys(child as Record<string, unknown>, path)
      : [path];
  });
}

function validateLocaleKeys() {
  const reference = flattenKeys(vi).sort();
  for (const [language, locale] of Object.entries({ en, fr, ja, ko, zh })) {
    const keys = flattenKeys(locale).sort();
    const missing = reference.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !reference.includes(key));
    if (missing.length || extra.length) {
      throw new Error(
        `i18n keys mismatch for ${language}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`
      );
    }
  }
}

export async function initializeI18n() {
  validateLocaleKeys();
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

  const deviceLanguage = getLocales()[0]?.languageCode ?? 'vi';

  const initialLanguage = savedLanguage
    ? supportedLanguages.includes(savedLanguage)
      ? savedLanguage
      : 'vi'
    : supportedLanguages.includes(deviceLanguage)
      ? deviceLanguage
      : 'vi';

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: false,
    interpolation: {
      escapeValue: false,
    },
  });
}

export async function changeAppLanguage(language: string) {
  if (!supportedLanguages.includes(language)) {
    return;
  }

  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}

export default i18n;
