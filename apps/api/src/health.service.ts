import { Inject, Injectable } from '@nestjs/common';
import type { ReadinessResponse } from '@novavend/contracts';

export type HealthCheck = () => Promise<void>;
export const POSTGRES_HEALTH_CHECK = Symbol('POSTGRES_HEALTH_CHECK');
export const REDIS_HEALTH_CHECK = Symbol('REDIS_HEALTH_CHECK');

@Injectable()
export class HealthService {
  constructor(
    @Inject(POSTGRES_HEALTH_CHECK) private readonly checkPostgres: HealthCheck,
    @Inject(REDIS_HEALTH_CHECK) private readonly checkRedis: HealthCheck,
  ) {}

  async checkReadiness(): Promise<ReadinessResponse> {
    const [postgres, redis] = await Promise.all([
      this.runCheck(this.checkPostgres),
      this.runCheck(this.checkRedis),
    ]);
    return {
      dependencies: { postgres, redis },
      service: 'api',
      status:
        postgres.status === 'up' && redis.status === 'up'
          ? 'ready'
          : 'unhealthy',
    };
  }

  private async runCheck(check: HealthCheck) {
    try {
      await check();
      return { status: 'up' as const };
    } catch (error) {
      return {
        message:
          error instanceof Error ? error.message : 'Dependency check failed',
        status: 'down' as const,
      };
    }
  }
}
