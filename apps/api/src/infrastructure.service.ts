import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { createDatabase } from '@novavend/database';
import type Redis from 'ioredis';

export const DATABASE_RESOURCE = Symbol('DATABASE_RESOURCE');
export const REDIS_RESOURCE = Symbol('REDIS_RESOURCE');
export type DatabaseResource = ReturnType<typeof createDatabase>;

@Injectable()
export class InfrastructureService implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_RESOURCE) private readonly database: DatabaseResource,
    @Inject(REDIS_RESOURCE) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.database.close(), this.closeRedis()]);
  }

  private async closeRedis(): Promise<void> {
    if (this.redis.status === 'end') return;
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
