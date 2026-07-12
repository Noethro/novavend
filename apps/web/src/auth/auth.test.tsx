import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n/locale-provider';
import { localeStorageKey } from '../i18n/locales';
import { AuthForm } from './auth-form';
import { authDestination } from './auth-client';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/login',
  useRouter: () => ({ push }),
}));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('authentication screens', () => {
  it.each([
    ['login', 'Sign in to NovaVend'],
    ['register', 'Create your merchant account'],
    ['onboarding', 'Create your first workspace'],
  ] as const)('renders an accessible %s form', async (mode, title) => {
    render(
      <LocaleProvider>
        <AuthForm mode={mode} />
      </LocaleProvider>,
    );
    expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it.each([
    ['en', 'Sign in to NovaVend'],
    ['tr', 'NovaVend hesabına giriş yap'],
    ['de', 'Bei NovaVend anmelden'],
    ['ru', 'Войти в NovaVend'],
    ['zh-CN', '登录 NovaVend'],
    ['ja', 'NovaVend にログイン'],
  ])('renders the login screen in %s', async (locale, title) => {
    localStorage.setItem(localeStorageKey, locale);
    render(
      <LocaleProvider>
        <AuthForm mode="login" />
      </LocaleProvider>,
    );
    expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
  });

  it('routes pending users to onboarding and active users home', () => {
    expect(authDestination({ needsOnboarding: true })).toBe('/onboarding');
    expect(authDestination({ needsOnboarding: false })).toBe('/');
  });

  it('never issues authentication requests in preview mode', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_MODE', 'true');
    const fetcher = vi.fn();
    const { postAuth } = await import('./auth-client');
    await expect(postAuth('/auth/login', {}, fetcher)).rejects.toThrow(
      'PREVIEW_MODE',
    );
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
