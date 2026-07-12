import { describe, expect, it } from 'vitest';
import {
  loadApiConfig,
  loadDatabaseConfig,
  loadRedisConfig,
  loadWebConfig,
  loadWorkerConfig,
} from './index';

const database = { DATABASE_URL: 'postgresql://localhost/novavend' };
const redis = { REDIS_URL: 'redis://localhost:6379' };

describe.each([
  [
    'web',
    loadWebConfig,
    { NEXT_PUBLIC_API_URL: 'https://api.example.com' },
    'NEXT_PUBLIC_API_URL',
  ],
  ['database', loadDatabaseConfig, database, 'DATABASE_URL'],
  ['redis', loadRedisConfig, redis, 'REDIS_URL'],
  ['api', loadApiConfig, { ...database, ...redis }, 'DATABASE_URL'],
  ['worker', loadWorkerConfig, { ...database, ...redis }, 'REDIS_URL'],
] as const)('%s configuration', (_name, loader, valid, requiredKey) => {
  it('accepts valid variables', () => {
    expect(() => loader(valid)).not.toThrow();
  });

  it('rejects a missing required variable', () => {
    const missing = { ...valid } as Record<string, string>;
    delete missing[requiredKey];
    expect(() => loader(missing)).toThrow();
  });

  it('rejects a malformed variable', () => {
    expect(() => loader({ ...valid, [requiredKey]: 'not-a-url' })).toThrow();
  });
});

describe('worker sample processor flag', () => {
  it('defaults to disabled', () => {
    expect(
      loadWorkerConfig({ ...database, ...redis }).ENABLE_SAMPLE_WORKER,
    ).toBe(false);
  });

  it('accepts an explicitly enabled flag', () => {
    expect(
      loadWorkerConfig({ ...database, ...redis, ENABLE_SAMPLE_WORKER: 'true' })
        .ENABLE_SAMPLE_WORKER,
    ).toBe(true);
  });

  it('rejects malformed booleans', () => {
    expect(() =>
      loadWorkerConfig({ ...database, ...redis, ENABLE_SAMPLE_WORKER: 'yes' }),
    ).toThrow();
  });
});

describe('authentication configuration', () => {
  it('derives secure cookies in production and keeps exact HTTPS origin', () => {
    const config = loadApiConfig({
      ...database,
      ...redis,
      API_ALLOWED_WEB_ORIGIN: 'https://app.example.com',
      NODE_ENV: 'production',
    });
    expect(config.SESSION_COOKIE_SECURE).toBe(true);
    expect(config.SESSION_TTL_SECONDS).toBe(604_800);
  });

  it('rejects insecure production origins and malformed limits', () => {
    expect(() =>
      loadApiConfig({
        ...database,
        ...redis,
        API_ALLOWED_WEB_ORIGIN: 'http://app.example.com',
        NODE_ENV: 'production',
      }),
    ).toThrow();
    expect(() =>
      loadApiConfig({ ...database, ...redis, AUTH_LOGIN_IP_LIMIT: '0' }),
    ).toThrow();
  });

  it('defaults the frontend preview mode to disabled', () => {
    expect(
      loadWebConfig({ NEXT_PUBLIC_API_URL: 'https://api.example.com' })
        .NEXT_PUBLIC_PREVIEW_MODE,
    ).toBe(false);
  });

  it('validates secure avatar-pairing expiry and clock-skew bounds', () => {
    const parsed = loadApiConfig({ ...database, ...redis });
    expect(parsed.AVATAR_PAIRING_TTL_SECONDS).toBe(600);
    expect(parsed.AVATAR_PAIRING_CLOCK_SKEW_SECONDS).toBe(300);
    expect(() =>
      loadApiConfig({
        ...database,
        ...redis,
        AVATAR_PAIRING_TTL_SECONDS: '10',
      }),
    ).toThrow();
    expect(() =>
      loadApiConfig({
        ...database,
        ...redis,
        AVATAR_PAIRING_CLOCK_SKEW_SECONDS: '9999',
      }),
    ).toThrow();
  });
});
