export const supportedLocales = [
  'en',
  'tr',
  'de',
  'ru',
  'zh-CN',
  'ja',
] as const;

export type Locale = (typeof supportedLocales)[number];

export const fallbackLocale: Locale = 'en';
export const localeStorageKey = 'novavend.locale';

export const localeNativeNames: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  ru: 'Русский',
  'zh-CN': '简体中文',
  ja: '日本語',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && supportedLocales.includes(value as Locale);

export const normalizeBrowserLocale = (value: string): Locale => {
  const tag = value.trim().toLowerCase().replace('_', '-');
  if (tag === 'tr' || tag.startsWith('tr-')) return 'tr';
  if (tag === 'de' || tag.startsWith('de-')) return 'de';
  if (tag === 'ru' || tag.startsWith('ru-')) return 'ru';
  if (tag === 'ja' || tag.startsWith('ja-')) return 'ja';
  if (
    tag === 'zh' ||
    tag === 'zh-cn' ||
    tag.startsWith('zh-cn-') ||
    tag === 'zh-sg' ||
    tag.startsWith('zh-sg-') ||
    tag.startsWith('zh-hans')
  ) {
    return 'zh-CN';
  }
  if (tag === 'en' || tag.startsWith('en-')) return 'en';
  return fallbackLocale;
};

export interface LocaleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const readSavedLocale = (
  storage?: LocaleStorage,
): Locale | undefined => {
  try {
    const value = storage?.getItem(localeStorageKey);
    return isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export const persistLocale = (
  locale: Locale,
  storage?: LocaleStorage,
): void => {
  try {
    storage?.setItem(localeStorageKey, locale);
  } catch {
    // Browsers can block storage; locale selection must still work in memory.
  }
};

export const resolveLocale = ({
  storage,
  browserLanguages = [],
}: {
  storage?: LocaleStorage;
  browserLanguages?: readonly string[];
}): Locale => {
  const saved = readSavedLocale(storage);
  if (saved) return saved;
  for (const language of browserLanguages) {
    const normalized = normalizeBrowserLocale(language);
    if (
      normalized !== fallbackLocale ||
      language.toLowerCase().startsWith('en')
    ) {
      return normalized;
    }
  }
  return fallbackLocale;
};
