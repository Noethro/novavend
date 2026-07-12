import { createHash, randomBytes } from 'node:crypto';

export const generatePairingToken = (): string =>
  randomBytes(24).toString('base64url');

export const hashPairingToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export const pairingRateFingerprint = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');
