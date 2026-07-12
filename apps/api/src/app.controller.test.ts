import { BadRequestException, Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller';
import { configureApi } from './configure-api';
import {
  HealthService,
  POSTGRES_HEALTH_CHECK,
  REDIS_HEALTH_CHECK,
} from './health.service';

const postgres = vi.fn<() => Promise<void>>();
const redis = vi.fn<() => Promise<void>>();

@Controller('test-error')
class ErrorController {
  @Get()
  fail(): never {
    throw new BadRequestException('Deliberate test error');
  }
}

@Module({
  controllers: [AppController, ErrorController],
  providers: [
    HealthService,
    { provide: POSTGRES_HEALTH_CHECK, useValue: postgres },
    { provide: REDIS_HEALTH_CHECK, useValue: redis },
  ],
})
class TestAppModule {}

describe('API health and global behavior', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    postgres.mockReset().mockResolvedValue(undefined);
    redis.mockReset().mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApi(app, 'test');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => app.close());

  it('reports liveness without checking dependencies', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ service: 'api', status: 'ok' });
    expect(postgres).not.toHaveBeenCalled();
    expect(redis).not.toHaveBeenCalled();
  });

  it('reports successful readiness', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      dependencies: { postgres: { status: 'up' }, redis: { status: 'up' } },
      status: 'ready',
    });
  });

  it('reports PostgreSQL unavailable', async () => {
    postgres.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      dependencies: {
        postgres: { message: 'PostgreSQL unavailable', status: 'down' },
      },
      status: 'unhealthy',
    });
  });

  it('reports Redis unavailable', async () => {
    redis.mockRejectedValueOnce(new Error('Redis unavailable'));
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      dependencies: { redis: { message: 'Redis unavailable', status: 'down' } },
      status: 'unhealthy',
    });
  });

  it('returns the standard API error response', async () => {
    const response = await app.inject({ method: 'GET', url: '/test-error' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Deliberate test error',
      status: 400,
    });
    expect(response.json().correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.json().timestamp).toBeTypeOf('string');
  });

  it('accepts a valid correlation ID and replaces an invalid one', async () => {
    const valid = '8cfa5ad3-4d4d-4a22-a4fa-95c77b2147c3';
    const accepted = await app.inject({
      headers: { 'x-correlation-id': valid },
      method: 'GET',
      url: '/health/live',
    });
    const generated = await app.inject({
      headers: { 'x-correlation-id': 'invalid' },
      method: 'GET',
      url: '/health/live',
    });
    expect(accepted.headers['x-correlation-id']).toBe(valid);
    expect(generated.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.headers['x-correlation-id']).not.toBe('invalid');
  });
});
