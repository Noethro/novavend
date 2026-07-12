import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n/locale-provider';
import { SessionGate } from './session-gate';

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const session = (needsOnboarding: boolean) => ({
  needsOnboarding,
  user: { displayName: 'Merchant', id: 'user-id', status: 'active' },
  workspaces: needsOnboarding
    ? []
    : [{ id: 'workspace-id', name: 'Shop', role: 'owner', slug: 'shop' }],
});

const renderGate = (fetcher: typeof fetch, isPreview = false) =>
  render(
    <LocaleProvider>
      <SessionGate fetcher={fetcher} isPreview={isPreview}>
        <h1>Dashboard content</h1>
      </SessionGate>
    </LocaleProvider>,
  );

describe('real session lifecycle', () => {
  beforeEach(() => replace.mockReset());
  afterEach(cleanup);

  it('redirects an unauthenticated dashboard visitor to login', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    renderGate(fetcher as never);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/auth/session'),
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
  });

  it('redirects a pending user to onboarding', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => session(true),
      ok: true,
      status: 200,
    });
    renderGate(fetcher as never);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding'));
  });

  it('allows an onboarded user to view the dashboard', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => session(false),
      ok: true,
      status: 200,
    });
    renderGate(fetcher as never);
    expect(
      await screen.findByRole('heading', { name: 'Dashboard content' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('logs out with credentials and redirects to login', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/auth/logout')
          ? { ok: true, status: 204 }
          : {
              json: async () => session(false),
              ok: true,
              status: 200,
            },
      ),
    );
    renderGate(fetcher as never);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });

  it('keeps preview mode network-free and visible', async () => {
    const fetcher = vi.fn();
    renderGate(fetcher as never, true);
    expect(
      await screen.findByRole('heading', { name: 'Dashboard content' }),
    ).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });
});
