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
