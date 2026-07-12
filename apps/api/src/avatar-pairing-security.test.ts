import { describe, expect, it } from 'vitest';
import {
  generatePairingToken,
  hashPairingToken,
  pairingRateFingerprint,
} from './avatar-pairing-security';

describe('avatar pairing token security', () => {
  it('generates copy-safe 192-bit tokens and stores only deterministic hashes', () => {
    const tokens = new Set(Array.from({ length: 32 }, generatePairingToken));
    expect(tokens.size).toBe(32);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(hashPairingToken(token)).toMatch(/^[a-f0-9]{64}$/);
      expect(hashPairingToken(token)).not.toContain(token);
    }
  });

  it('uses irreversible fingerprints for Redis rate-limit dimensions', () => {
    expect(pairingRateFingerprint('token-or-network')).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(pairingRateFingerprint('token-or-network')).not.toContain(
      'token-or-network',
    );
  });
});
