import type { TranslationKey } from './dictionaries';

export type NavigationItem =
  | { key: TranslationKey; href: '/' | '/status'; comingSoon: false }
  | { key: TranslationKey; comingSoon: true };

export const navigationItems: readonly NavigationItem[] = [
  { key: 'nav.overview', href: '/', comingSoon: false },
  { key: 'nav.products', comingSoon: true },
  { key: 'nav.vendors', comingSoon: true },
  { key: 'nav.sales', comingSoon: true },
  { key: 'nav.deliveries', comingSoon: true },
  { key: 'nav.customers', comingSoon: true },
  { key: 'nav.devices', comingSoon: true },
  { key: 'nav.analytics', comingSoon: true },
  { key: 'nav.settings', comingSoon: true },
  { key: 'nav.status', href: '/status', comingSoon: false },
] as const;
