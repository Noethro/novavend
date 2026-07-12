import { createDatabase } from '@novavend/database';
import Redis from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';

const database = createDatabase(
  process.env.DATABASE_URL ??
    'postgresql://novavend:novavend@127.0.0.1:5432/novavend',
);
const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 1,
});

describe('PostgreSQL and Redis integration', () => {
  afterAll(async () => {
    await Promise.all([database.close(), redis.quit()]);
  });

  it('connects to PostgreSQL', async () => {
    await expect(database.checkConnectivity()).resolves.toBeUndefined();
  });

  it('connects to Redis', async () => {
    await expect(redis.ping()).resolves.toBe('PONG');
  });
});
