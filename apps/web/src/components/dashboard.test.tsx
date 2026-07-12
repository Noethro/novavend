import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardShell } from './dashboard-shell';
import { OverviewPage } from './overview-page';
import { SystemStatusPage } from './status-page';
import { LocaleProvider } from '../i18n/locale-provider';
import { localeStorageKey } from '../i18n/locales';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

afterEach(cleanup);

function TestApp({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <DashboardShell>{children}</DashboardShell>
    </LocaleProvider>
  );
}

describe('multilingual dashboard shell', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('renders the complete dashboard shell in English', async () => {
    render(
      <TestApp>
        <OverviewPage />
      </TestApp>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Merchant overview' }),
    ).toBeTruthy();
    expect(screen.getByText('Setup progress')).toBeTruthy();
    expect(screen.getByText('Recent activity')).toBeTruthy();
    expect(screen.getByText('Device health')).toBeTruthy();
  });

  it.each([
    ['en', 'Merchant overview'],
    ['tr', 'Satıcı genel bakışı'],
    ['de', 'Händlerübersicht'],
    ['ru', 'Обзор для продавца'],
    ['zh-CN', '商户概览'],
    ['ja', 'マーチャント概要'],
  ])('renders representative %s interface text', async (locale, title) => {
    localStorage.setItem(localeStorageKey, locale);
    render(
      <TestApp>
        <OverviewPage />
      </TestApp>,
    );
    expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
  });

  it('changes the visible interface, persists locale, and updates document lang', async () => {
    render(
      <TestApp>
        <OverviewPage />
      </TestApp>,
    );
    const selector = await screen.findByRole('combobox', { name: 'Language' });
    fireEvent.change(selector, { target: { value: 'tr' } });
    expect(
      await screen.findByRole('heading', { name: 'Satıcı genel bakışı' }),
    ).toBeTruthy();
    expect(localStorage.getItem(localeStorageKey)).toBe('tr');
    expect(document.documentElement.lang).toBe('tr');
  });

  it('shows only the static frontend as available and performs no fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <TestApp>
        <SystemStatusPage />
      </TestApp>,
    );
    expect(await screen.findByText('Available')).toBeTruthy();
    expect(screen.getAllByText('Not connected yet')).toHaveLength(5);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('provides an accessible mobile navigation control', async () => {
    render(
      <TestApp>
        <OverviewPage />
      </TestApp>,
    );
    const button = await screen.findByRole('button', {
      name: 'Open navigation',
    });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(1);
  });

  it('survives blocked browser storage', async () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    render(
      <TestApp>
        <OverviewPage />
      </TestApp>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Merchant overview' }),
      ).toBeTruthy(),
    );
    getItem.mockRestore();
  });
});
