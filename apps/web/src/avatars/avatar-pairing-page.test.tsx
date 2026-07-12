import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../i18n/locale-provider';
import {
  AvatarPairingPage,
  pairingSecondsRemaining,
  shouldPollPairing,
} from './avatar-pairing-page';

afterEach(cleanup);
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
  it('renders an honest network-free preview', async () => {
    const fetcher = vi.fn();
    render(
      <LocaleProvider>
        <AvatarPairingPage fetcher={fetcher as never} isPreview />
      </LocaleProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Second Life avatars' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Create pairing token' }),
    ).toHaveProperty('disabled', true);
    expect(screen.getByText(/no usable token is generated/i)).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
