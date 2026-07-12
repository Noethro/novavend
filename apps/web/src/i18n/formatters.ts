import type { Locale } from './locales';

const dateOptions: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeZone: 'UTC',
};

const timeOptions: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
};

export const formatDate = (value: Date | number, locale: Locale): string =>
  new Intl.DateTimeFormat(locale, dateOptions).format(value);

export const formatTime = (value: Date | number, locale: Locale): string =>
  new Intl.DateTimeFormat(locale, timeOptions).format(value);

export const formatInteger = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

export const formatDecimal = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const formatPercentage = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);

export const formatLindenDollars = (value: number, locale: Locale): string =>
  `L$ ${formatInteger(value, locale)}`;
