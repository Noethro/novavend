import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AuthenticationRepository, createDatabase } from '@novavend/database';
import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { configureApi } from './configure-api';

const origin = 'http://localhost:3000';
const database = createDatabase(
  process.env.DATABASE_URL ??
    'postgresql://novavend:novavend@127.0.0.1:5432/novavend',
);
const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 1,
});
const repository = new AuthenticationRepository(database.database);
let app: NestFastifyApplication;

const registration = {
  displayName: 'Nova Merchant',
  email: 'merchant@example.com',
  password: 'correct horse battery',
};

const register = async (body = registration, requestOrigin = origin) =>
  app.inject({
    body,
    headers: { origin: requestOrigin },
    method: 'POST',
    url: '/auth/register',
  });

const cookieFrom = (response: { headers: Record<string, unknown> }) =>
  String(response.headers['set-cookie']).split(';')[0] ?? '';

describe.sequential('authentication and onboarding integration', () => {
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    configureApi(app, 'test', origin);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    await database.client.unsafe(
      'truncate table audit_logs, idempotency_records, workspace_avatar_accounts, avatar_accounts, workspace_members, workspaces, user_sessions, user_password_credentials, users restart identity cascade',
    );
    await redis.flushdb();
  });

  afterAll(async () => {
    await app.close();
    await Promise.all([database.close(), redis.quit()]);
  });

  it('registers a pending user, credential, and session atomically', async () => {
    const response = await register();
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      needsOnboarding: true,
      user: { status: 'pending' },
    });
    const [counts] = await database.client.unsafe<
      Array<{ users: number; credentials: number; sessions: number }>
    >(
      'select (select count(*)::int from users) users, (select count(*)::int from user_password_credentials) credentials, (select count(*)::int from user_sessions) sessions',
    );
    expect(counts).toEqual({ users: 1, credentials: 1, sessions: 1 });
  });

  it('stores an Argon2id hash rather than the raw password', async () => {
    await register();
    const [row] = await database.client.unsafe<
      Array<{ password_hash: string }>
    >('select password_hash from user_password_credentials');
    expect(row?.password_hash).toMatch(/^\$argon2id\$/);
    expect(row?.password_hash).not.toContain(registration.password);
  });

  it('rejects duplicate normalized email safely', async () => {
    await register();
    const duplicate = await register({
      ...registration,
      email: '  MERCHANT@example.com  ',
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().code).toBe('AUTH_EMAIL_CONFLICT');
  });

  it('rolls back user creation when credential insertion fails', async () => {
    await expect(
      repository.register({
        displayName: 'Broken',
        email: 'broken@example.com',
        passwordHash: null as never,
      }),
    ).rejects.toThrow();
    const [row] = await database.client.unsafe<Array<{ count: number }>>(
      "select count(*)::int count from users where email_normalized='broken@example.com'",
    );
    expect(row?.count).toBe(0);
  });

  it('logs in with the correct password and sets an opaque cookie', async () => {
    await register();
    const response = await app.inject({
      body: { email: registration.email, password: registration.password },
      headers: { origin },
      method: 'POST',
      url: '/auth/login',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('novavend_session=');
  });

  it('uses the same public error for unknown email and wrong password', async () => {
    await register();
    const attempts = await Promise.all([
      app.inject({
        body: { email: 'unknown@example.com', password: registration.password },
        headers: { origin },
        method: 'POST',
        url: '/auth/login',
      }),
      app.inject({
        body: { email: registration.email, password: 'wrong-password-value' },
        headers: { origin },
        method: 'POST',
        url: '/auth/login',
      }),
    ]);
    expect(attempts.map((item) => [item.statusCode, item.json().code])).toEqual(
      [
        [401, 'AUTH_INVALID_CREDENTIALS'],
        [401, 'AUTH_INVALID_CREDENTIALS'],
      ],
    );
  });

  it('persists only a SHA-256 session token hash', async () => {
    const response = await register();
    const raw = cookieFrom(response).split('=')[1] ?? '';
    const [row] = await database.client.unsafe<Array<{ token_hash: string }>>(
      'select token_hash from user_sessions',
    );
    expect(row?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row?.token_hash).not.toBe(raw);
  });

  it('resolves a valid current session with safe fields', async () => {
    const response = await register();
    const session = await app.inject({
      headers: { cookie: cookieFrom(response) },
      method: 'GET',
      url: '/auth/session',
    });
    expect(session.statusCode).toBe(200);
    expect(session.json()).not.toHaveProperty('passwordHash');
    expect(session.json()).not.toHaveProperty('tokenHash');
  });

  it('rejects an expired session', async () => {
    const response = await register();
    await database.client.unsafe(
      "update user_sessions set expires_at=now()-interval '1 second'",
    );
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(response) },
          method: 'GET',
          url: '/auth/session',
        })
      ).statusCode,
    ).toBe(401);
  });

  it('rejects a revoked session', async () => {
    const response = await register();
    await database.client.unsafe('update user_sessions set revoked_at=now()');
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(response) },
          method: 'GET',
          url: '/auth/session',
        })
      ).statusCode,
    ).toBe(401);
  });

  it('rejects suspended and deleted users', async () => {
    const response = await register();
    await database.client.unsafe("update users set status='suspended'");
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(response) },
          method: 'GET',
          url: '/auth/session',
        })
      ).statusCode,
    ).toBe(401);
    await database.client.unsafe(
      "update users set status='deleted', deleted_at=now()",
    );
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(response) },
          method: 'GET',
          url: '/auth/session',
        })
      ).statusCode,
    ).toBe(401);
  });

  it('logs out idempotently, revokes the session, and expires the cookie', async () => {
    const response = await register();
    const logout = await app.inject({
      headers: { cookie: cookieFrom(response), origin },
      method: 'POST',
      url: '/auth/logout',
    });
    expect(logout.statusCode).toBe(204);
    expect(logout.headers['set-cookie']).toContain('Max-Age=0');
    const [row] = await database.client.unsafe<Array<{ revoked: boolean }>>(
      'select revoked_at is not null revoked from user_sessions',
    );
    expect(row?.revoked).toBe(true);
  });

  it('requires authentication for workspace onboarding', async () => {
    const response = await app.inject({
      body: { name: 'Nova Shop' },
      headers: { origin },
      method: 'POST',
      url: '/onboarding/workspace',
    });
    expect(response.statusCode).toBe(401);
  });

  it('creates the first workspace and active owner atomically', async () => {
    const registered = await register();
    const response = await app.inject({
      body: { name: 'Nova Shop' },
      headers: { cookie: cookieFrom(registered), origin },
      method: 'POST',
      url: '/onboarding/workspace',
    });
    expect(response.statusCode).toBe(201);
    const [member] = await database.client.unsafe<
      Array<{ role: string; status: string }>
    >('select role,status from workspace_members');
    expect(member).toEqual({ role: 'owner', status: 'active' });
  });

  it('activates a pending user after onboarding', async () => {
    const registered = await register();
    await app.inject({
      body: { name: 'Nova Shop' },
      headers: { cookie: cookieFrom(registered), origin },
      method: 'POST',
      url: '/onboarding/workspace',
    });
    const [user] = await database.client.unsafe<Array<{ status: string }>>(
      'select status from users',
    );
    expect(user?.status).toBe('active');
  });

  it('rolls back onboarding when the slug conflicts', async () => {
    const first = await register();
    await app.inject({
      body: { name: 'Nova Shop', slug: 'nova-shop' },
      headers: { cookie: cookieFrom(first), origin },
      method: 'POST',
      url: '/onboarding/workspace',
    });
    const second = await register({
      ...registration,
      email: 'second@example.com',
    });
    const conflict = await app.inject({
      body: { name: 'Other', slug: 'nova-shop' },
      headers: { cookie: cookieFrom(second), origin },
      method: 'POST',
      url: '/onboarding/workspace',
    });
    expect(conflict.statusCode).toBe(400);
    const [user] = await database.client.unsafe<Array<{ status: string }>>(
      "select status from users where email_normalized='second@example.com'",
    );
    expect(user?.status).toBe('pending');
  });

  it('makes duplicate first-onboarding retries deterministic', async () => {
    const registered = await register();
    const options = {
      body: { name: 'Nova Shop' },
      headers: { cookie: cookieFrom(registered), origin },
      method: 'POST' as const,
      url: '/onboarding/workspace',
    };
    expect((await app.inject(options)).statusCode).toBe(201);
    expect((await app.inject(options)).statusCode).toBe(409);
    const [row] = await database.client.unsafe<Array<{ count: number }>>(
      'select count(*)::int count from workspaces',
    );
    expect(row?.count).toBe(1);
  });

  it('cannot use one user session to resolve another user', async () => {
    const first = await register();
    await register({ ...registration, email: 'second@example.com' });
    const session = await app.inject({
      headers: { cookie: cookieFrom(first) },
      method: 'GET',
      url: '/auth/session',
    });
    expect(session.json().user.displayName).toBe(registration.displayName);
  });

  it('rate limits through Redis without raw identity keys', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1)
      await register({ ...registration, email: `user${attempt}@example.com` });
    const limited = await register({
      ...registration,
      email: 'limited@example.com',
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().code).toBe('AUTH_RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect((await redis.keys('novavend:auth:*')).join(' ')).not.toContain(
      'example.com',
    );
  });

  it('rejects unexpected origins for credentialed mutations', async () => {
    const response = await register(registration, 'https://evil.example.com');
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('AUTH_ORIGIN_REJECTED');
  });

  it('writes safe audit events without credentials or tokens', async () => {
    const registered = await register();
    await app.inject({
      headers: { cookie: cookieFrom(registered), origin },
      method: 'POST',
      url: '/auth/logout',
    });
    const rows = await database.client.unsafe<Array<{ metadata: unknown }>>(
      'select metadata from audit_logs',
    );
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(registration.password);
    expect(serialized).not.toContain('novavend_session');
    expect(serialized).not.toContain(registration.email);
  });

  it('cleans expired and revoked sessions explicitly', async () => {
    await register();
    await database.client.unsafe(
      "update user_sessions set expires_at=now()-interval '1 second'",
    );
    await expect(repository.deleteExpiredOrRevokedSessions()).resolves.toBe(1);
  });
});
