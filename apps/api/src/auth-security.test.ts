import { describe, expect, it } from 'vitest';
import {
  ARGON2_PARAMETERS,
  expiredSessionCookie,
  fingerprintEmail,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isAllowedMutationOrigin,
  readCookie,
  sessionCookie,
  validatePasswordPolicy,
  verifyPassword,
} from './auth-security';

describe('authentication security primitives', () => {
  it('enforces 12 to 128 Unicode characters without trimming', () => {
    expect(validatePasswordPolicy('x'.repeat(11))).toBe(false);
    expect(validatePasswordPolicy(' şifre '.repeat(2))).toBe(true);
    expect(validatePasswordPolicy('x'.repeat(129))).toBe(false);
  });

  it('uses reviewed Argon2id parameters and verifies without exposing raw text', async () => {
    expect(ARGON2_PARAMETERS).toMatchObject({
      memory: 65_536,
      parallelism: 1,
      passes: 3,
    });
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(hash).not.toContain('correct horse battery');
    await expect(verifyPassword(hash, 'correct horse battery')).resolves.toBe(
      true,
    );
    await expect(verifyPassword(hash, 'incorrect password')).resolves.toBe(
      false,
    );
  });

  it('generates 256-bit opaque tokens and hashes them for persistence', () => {
    const token = generateSessionToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
  });

  it('creates narrow HttpOnly SameSite cookies with environment-specific Secure', () => {
    const development = sessionCookie('token', {
      cookieName: 'novavend_session',
      maxAgeSeconds: 60,
      secure: false,
    });
    const production = sessionCookie('token', {
      cookieName: 'novavend_session',
      maxAgeSeconds: 60,
      secure: true,
    });
    expect(development).toContain('HttpOnly; SameSite=Lax; Max-Age=60');
    expect(development).not.toContain('Secure');
    expect(production).toContain('; Secure');
    expect(
      expiredSessionCookie({
        cookieName: 'novavend_session',
        maxAgeSeconds: 60,
        secure: true,
      }),
    ).toContain('Max-Age=0; Secure');
  });

  it('reads only the requested cookie', () => {
    expect(
      readCookie('other=x; novavend_session=secret', 'novavend_session'),
    ).toBe('secret');
  });

  it('accepts only the exact configured mutation origin', () => {
    expect(
      isAllowedMutationOrigin(
        'https://app.example.com',
        'https://app.example.com',
      ),
    ).toBe(true);
    expect(
      isAllowedMutationOrigin(
        'https://evil.example.com',
        'https://app.example.com',
      ),
    ).toBe(false);
    expect(isAllowedMutationOrigin(undefined, 'https://app.example.com')).toBe(
      false,
    );
  });

  it('uses one-way fingerprints for private rate-limit keys', () => {
    expect(fingerprintEmail('merchant@example.com')).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintEmail('merchant@example.com')).not.toContain(
      'merchant@example.com',
    );
  });
});
