import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n/locale-provider';
import {
  AvatarPairingPage,
  copyPairingToken,
  pairingSecondsRemaining,
  shouldPollPairing,
} from './avatar-pairing-page';

afterEach(cleanup);

const renderRealPairing = (copyText: (value: string) => Promise<boolean>) => {
  const pairingToken = '0123456789abcdefghijklmnopqrstuv';
  const fetcher = vi
    .fn()
    .mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/session'))
        return Promise.resolve({
          json: async () => ({
            needsOnboarding: false,
            user: { displayName: 'Merchant', id: 'user-id', status: 'active' },
            workspaces: [
              { id: 'workspace-id', name: 'Shop', role: 'owner', slug: 'shop' },
            ],
          }),
          ok: true,
          status: 200,
        });
      if (url.endsWith('/avatars') && (!init?.method || init.method === 'GET'))
        return Promise.resolve({
          json: async () => ({ avatars: [] }),
          ok: true,
          status: 200,
        });
      return Promise.resolve({
        json: async () => ({
          challengeId: 'challenge-id',
          expiresAt: '2099-07-12T12:10:00.000Z',
          pairingToken,
          status: 'pending',
        }),
        ok: true,
        status: 201,
      });
    });
  render(
    <LocaleProvider>
      <AvatarPairingPage
        copyText={copyText}
        fetcher={fetcher as never}
        isPreview={false}
      />
    </LocaleProvider>,
  );
  return { fetcher, pairingToken };
};

describe('avatar pairing preview', () => {
  it('bounds countdowns and terminates polling on terminal, expired, or repeated-failure states', () => {
    const expiresAt = '2026-07-12T12:10:00.000Z';
    const now = new Date('2026-07-12T12:09:30.000Z').getTime();
    expect(pairingSecondsRemaining(expiresAt, now)).toBe(30);
    expect(pairingSecondsRemaining(expiresAt, now + 60_000)).toBe(0);
    expect(shouldPollPairing('pending', 0, expiresAt, now)).toBe(true);
    expect(shouldPollPairing('claimed', 0, expiresAt, now)).toBe(false);
    expect(shouldPollPairing('pending', 3, expiresAt, now)).toBe(false);
  });
  it('renders an honest network-free preview without copying or exposing a token', async () => {
    const fetcher = vi.fn();
    const copyText = vi.fn();
    render(
      <LocaleProvider>
        <AvatarPairingPage
          copyText={copyText}
          fetcher={fetcher as never}
          isPreview
        />
      </LocaleProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Second Life avatars' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Create pairing token' }),
    ).toHaveProperty('disabled', true);
    expect(screen.getByText(/no usable token is generated/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy token' })).toBeNull();
    expect(screen.queryByText(/^[A-Za-z0-9_-]{32}$/)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(copyText).not.toHaveBeenCalled();
  });
});

describe('pairing token copy', () => {
  it('uses the Clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(
      copyPairingToken('A'.repeat(32), { writeText }, document),
    ).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('A'.repeat(32));
  });

  it('uses a temporary, removed textarea fallback when Clipboard API is unavailable', async () => {
    const original = document.execCommand;
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    try {
      await expect(
        copyPairingToken('B'.repeat(32), null, document),
      ).resolves.toBe(true);
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(document.querySelector('textarea')).toBeNull();
    } finally {
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: original,
      });
    }
  });

  it.each([
    [true, 'Token copied.', 'status'],
    [
      false,
      'The token could not be copied. Select and copy it manually.',
      'alert',
    ],
  ] as const)(
    'shows localized accessible feedback when copy result is %s',
    async (result, message, role) => {
      const copyText = vi.fn().mockResolvedValue(result);
      const { pairingToken } = renderRealPairing(copyText);
      const create = await screen.findByRole('button', {
        name: 'Create pairing token',
      });
      await waitFor(() => expect(create).toHaveProperty('disabled', false));
      fireEvent.click(create);
      fireEvent.click(
        await screen.findByRole('button', { name: 'Copy token' }),
      );
      expect((await screen.findByText(message)).getAttribute('role')).toBe(
        role,
      );
      expect(copyText).toHaveBeenCalledWith(pairingToken);
    },
  );
});
