import { describe, expect, it } from 'vitest';
import { dictionaries, englishDictionary, translate } from './dictionaries';
import {
  fallbackLocale,
  isLocale,
  localeStorageKey,
  normalizeBrowserLocale,
  persistLocale,
  resolveLocale,
  supportedLocales,
  type LocaleStorage,
} from './locales';

describe('locale model', () => {
  it('validates exactly the six supported locale identifiers', () => {
    expect(supportedLocales).toEqual(['en', 'tr', 'de', 'ru', 'zh-CN', 'ja']);
    expect(supportedLocales.every(isLocale)).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });

  it.each([
    ['tr-TR', 'tr'],
    ['de-AT', 'de'],
    ['ru-RU', 'ru'],
    ['zh-CN', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-Hans-HK', 'zh-CN'],
    ['ja-JP', 'ja'],
    ['fr-FR', 'en'],
  ])('normalizes browser language %s to %s', (input, expected) => {
    expect(normalizeBrowserLocale(input)).toBe(expected);
  });

  it('prefers saved locale over browser locale', () => {
    const storage = { getItem: () => 'de', setItem: () => undefined };
    expect(resolveLocale({ storage, browserLanguages: ['tr-TR'] })).toBe('de');
  });

  it('uses browser locale and then English fallback', () => {
    const storage = { getItem: () => null, setItem: () => undefined };
    expect(
      resolveLocale({ storage, browserLanguages: ['fr-FR', 'ja-JP'] }),
    ).toBe('ja');
    expect(resolveLocale({ storage, browserLanguages: ['fr-FR'] })).toBe(
      fallbackLocale,
    );
  });

  it('handles unavailable storage without crashing', () => {
    const storage: LocaleStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(resolveLocale({ storage, browserLanguages: ['tr-TR'] })).toBe('tr');
    expect(() => persistLocale('ja', storage)).not.toThrow();
  });

  it('persists the selected locale under the namespaced key', () => {
    const values = new Map<string, string>();
    persistLocale('zh-CN', {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });
    expect(values.get(localeStorageKey)).toBe('zh-CN');
  });
});

describe('translation dictionaries', () => {
  it('contains every English key in all six dictionaries', () => {
    const keys = Object.keys(englishDictionary).sort();
    for (const locale of supportedLocales) {
      expect(Object.keys(dictionaries[locale]).sort()).toEqual(keys);
      expect(Object.values(dictionaries[locale]).every(Boolean)).toBe(true);
    }
  });

  it('falls back to English for a missing runtime key', () => {
    expect(
      translate('tr', 'overview.title', { en: englishDictionary, tr: {} }),
    ).toBe(englishDictionary['overview.title']);
  });
});
