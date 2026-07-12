import { describe, expect, it, vi } from 'vitest';
import { AuthRateLimiter } from './auth-rate-limit';

describe('Redis authentication throttling', () => {
  it('uses bounded counters and returns retry timing', async () => {
    const redis = {
      eval: vi
        .fn()
        .mockResolvedValueOnce([1, 120])
        .mockResolvedValueOnce([3, 120]),
    };
    const limiter = new AuthRateLimiter(redis as never, 900);
    await expect(limiter.consume('safe-key', 2)).resolves.toEqual({
      allowed: true,
      retryAfter: 120,
    });
    await expect(limiter.consume('safe-key', 2)).resolves.toEqual({
      allowed: false,
      retryAfter: 120,
    });
    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(redis.eval.mock.calls[0]?.slice(1)).toEqual([1, 'safe-key', 900]);
    expect(redis.eval.mock.calls[0]?.[0]).toContain("redis.call('EXPIRE'");
  });

  it('never places raw email or IP values in Redis keys', () => {
    const limiter = new AuthRateLimiter({} as never, 900);
    const key = limiter.loginIdentityKey('203.0.113.4', 'merchant@example.com');
    expect(key).not.toContain('203.0.113.4');
    expect(key).not.toContain('merchant@example.com');
  });
});
