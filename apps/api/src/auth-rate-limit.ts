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
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, this.windowSeconds);
    const ttl = Math.max(await this.redis.ttl(key), 1);
    return { allowed: count <= limit, retryAfter: ttl };
  }
}
