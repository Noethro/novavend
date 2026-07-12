'use client';

import {
  localeNativeNames,
  supportedLocales,
  type Locale,
} from '../i18n/locales';
import { useLocale } from '../i18n/locale-provider';

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="language-selector">
      <span>{t('languageLabel')}</span>
      <select
        aria-label={t('languageLabel')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {supportedLocales.map((item) => (
          <option key={item} value={item}>
            {localeNativeNames[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
