import { describe, expect, it } from 'vitest';
import { navigationItems } from './navigation';

describe('dashboard navigation', () => {
  it('exposes Overview, Avatars, and System status as real routes', () => {
    const routes = navigationItems.filter((item) => !item.comingSoon);
    expect(routes).toEqual([
      { key: 'nav.overview', href: '/', comingSoon: false },
      { key: 'nav.avatars', href: '/avatars', comingSoon: false },
      { key: 'nav.status', href: '/status', comingSoon: false },
    ]);
  });

  it('marks every future capability as coming soon without a route', () => {
    const future = navigationItems.filter((item) => item.comingSoon);
    expect(future).toHaveLength(8);
    expect(future.every((item) => !('href' in item))).toBe(true);
  });
});
