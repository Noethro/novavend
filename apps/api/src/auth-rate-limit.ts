import type Redis from 'ioredis';
import { fingerprintEmail } from './auth-security';

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
}

export class AuthRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly windowSeconds: number,
  ) {}

  registrationKey(ip: string): string {
    return `novavend:auth:register:ip:${fingerprintEmail(ip)}`;
  }

  loginIpKey(ip: string): string {
    return `novavend:auth:login:ip:${fingerprintEmail(ip)}`;
  }

  loginIdentityKey(ip: string, emailNormalized: string): string {
    return `novavend:auth:login:identity:${fingerprintEmail(ip)}:${fingerprintEmail(emailNormalized)}`;
  }

  async consume(key: string, limit: number): Promise<RateLimitDecision> {
    if (this.redis.status === 'wait') await this.redis.connect();
    const [rawCount, rawTtl] = (await this.redis.eval(
      `local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}`,
      1,
      key,
      this.windowSeconds,
    )) as [number, number];
    const count = Number(rawCount);
    const ttl = Math.max(Number(rawTtl), 1);
    return { allowed: count <= limit, retryAfter: ttl };
  }
}
