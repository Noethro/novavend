'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translate, type TranslationKey } from './dictionaries';
import {
  fallbackLocale,
  persistLocale,
  resolveLocale,
  type Locale,
} from './locales';

interface LocaleContextValue {
  locale: Locale;
  ready: boolean;
  setLocale(locale: Locale): void;
  t(key: TranslationKey): string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(fallbackLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const resolved = resolveLocale({
      storage: window.localStorage,
      browserLanguages: navigator.languages,
    });
    setLocaleState(resolved);
    document.documentElement.lang = resolved;
    setReady(true);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    persistLocale(nextLocale, window.localStorage);
    document.documentElement.lang = nextLocale;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      ready,
      setLocale,
      t: (key) => translate(locale, key),
    }),
    [locale, ready, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
};
