import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AuthenticationRepository, createDatabase } from '@novavend/database';
import Redis from 'ioredis';
import { DeviceType, PROTOCOL_VERSION } from '@novavend/secondlife-protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { configureApi } from './configure-api';
import { REDIS_RESOURCE } from './infrastructure.service';

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

const onboard = async (
  registered: Awaited<ReturnType<typeof register>>,
  name = 'Nova Shop',
) =>
  app.inject({
    body: { name },
    headers: { cookie: cookieFrom(registered), origin },
    method: 'POST',
    url: '/onboarding/workspace',
  });

const claimEnvelope = (
  pairingToken: string,
  deviceId = randomUUID(),
  messageId = randomUUID(),
) => ({
  deviceId,
  deviceType: DeviceType.AvatarLink,
  messageId,
  payload: { pairingToken },
  sentAt: new Date().toISOString(),
  version: PROTOCOL_VERSION,
});

describe.sequential('authentication and onboarding integration', () => {
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({ bodyLimit: 8192 }),
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
    const keys = await redis.keys('novavend:auth:*');
    expect(keys.join(' ')).not.toContain('example.com');
    const ttls = await Promise.all(keys.map((key) => redis.ttl(key)));
    expect(ttls.every((ttl) => ttl > 0)).toBe(true);
  });

  it('rejects unexpected origins for credentialed mutations', async () => {
    const response = await register(registration, 'https://evil.example.com');
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('AUTH_ORIGIN_REJECTED');
  });

  it.each([
    `/workspaces/${randomUUID()}/avatar-pairings/${randomUUID()}`,
    `/workspaces/${randomUUID()}/avatars/${randomUUID()}`,
  ])(
    'allows an exact-origin credentialed DELETE preflight for %s',
    async (url) => {
      const response = await app.inject({
        headers: {
          'access-control-request-method': 'DELETE',
          origin,
        },
        method: 'OPTIONS',
        url,
      });
      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(
        String(response.headers['access-control-allow-methods'])
          .split(',')
          .map((method) => method.trim()),
      ).toContain('DELETE');
    },
  );

  it('does not authorize an unexpected origin during DELETE preflight', async () => {
    const unexpectedOrigin = 'https://evil.example.com';
    const response = await app.inject({
      headers: {
        'access-control-request-method': 'DELETE',
        origin: unexpectedOrigin,
      },
      method: 'OPTIONS',
      url: `/workspaces/${randomUUID()}/avatars/${randomUUID()}`,
    });
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-origin']).not.toBe(
      unexpectedOrigin,
    );
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

  it('creates a hash-only workspace pairing challenge and never returns the token again', async () => {
    const registered = await register();
    const onboarding = await onboard(registered);
    const workspaceId = onboarding.json().workspace.id as string;
    const created = await app.inject({
      headers: { cookie: cookieFrom(registered), origin },
      method: 'POST',
      url: `/workspaces/${workspaceId}/avatar-pairings`,
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.pairingToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const [stored] = await database.client.unsafe<
      Array<{ token_hash: string }>
    >('select token_hash from avatar_pairing_challenges');
    expect(stored?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.token_hash).not.toContain(body.pairingToken);
    const status = await app.inject({
      headers: { cookie: cookieFrom(registered) },
      method: 'GET',
      url: `/workspaces/${workspaceId}/avatar-pairings/${body.challengeId}`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).not.toHaveProperty('pairingToken');
    expect(status.json()).not.toHaveProperty('tokenHash');
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(registered), origin },
          method: 'POST',
          url: `/workspaces/${workspaceId}/avatar-pairings`,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(registered), origin },
          method: 'POST',
          url: `/workspaces/${workspaceId}/avatar-pairings`,
        })
      ).statusCode,
    ).toBe(201);
    const limited = await app.inject({
      headers: { cookie: cookieFrom(registered), origin },
      method: 'POST',
      url: `/workspaces/${workspaceId}/avatar-pairings`,
    });
    expect(limited.statusCode).toBe(409);
    expect(limited.json().code).toBe('PAIRING_PENDING_LIMIT');
  });

  it('atomically claims, replays, lists, revokes, and reactivates an avatar link', async () => {
    const registered = await register();
    const onboarding = await onboard(registered);
    const workspaceId = onboarding.json().workspace.id as string;
    const created = await app.inject({
      headers: { cookie: cookieFrom(registered), origin },
      method: 'POST',
      url: `/workspaces/${workspaceId}/avatar-pairings`,
    });
    const envelope = claimEnvelope(created.json().pairingToken);
    const simulatorHeaders = {
      'content-type': 'application/json',
      'x-secondlife-object-key': envelope.deviceId,
      'x-secondlife-owner-key': '9e1635f4-e428-44f0-8405-93a021740bda',
      'x-secondlife-owner-name': 'Nova Resident',
    };
    const [first, replay] = await Promise.all(
      [0, 1].map(() =>
        app.inject({
          body: envelope,
          headers: simulatorHeaders,
          method: 'POST',
          url: '/secondlife/v1/avatar-pairings/claim',
        }),
      ),
    );
    expect([first!.json().code, replay!.json().code].sort()).toEqual([
      'LINKED',
      'REPLAYED',
    ]);
    const crossAvatar = await app.inject({
      body: envelope,
      headers: { ...simulatorHeaders, 'x-secondlife-owner-key': randomUUID() },
      method: 'POST',
      url: '/secondlife/v1/avatar-pairings/claim',
    });
    expect(crossAvatar.statusCode).toBe(409);
    expect(crossAvatar.json().code).toBe('PAIRING_CONSUMED');
    const listed = await app.inject({
      headers: { cookie: cookieFrom(registered) },
      method: 'GET',
      url: `/workspaces/${workspaceId}/avatars`,
    });
    expect(listed.json().avatars).toHaveLength(1);
    const avatarId = listed.json().avatars[0].id as string;
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(registered), origin },
          method: 'DELETE',
          url: `/workspaces/${workspaceId}/avatars/${avatarId}`,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await database.client.unsafe<Array<{ count: number }>>(
          'select count(*)::int count from avatar_accounts',
        )
      )[0]?.count,
    ).toBe(1);
    const next = await app.inject({
      headers: { cookie: cookieFrom(registered), origin },
      method: 'POST',
      url: `/workspaces/${workspaceId}/avatar-pairings`,
    });
    const nextEnvelope = claimEnvelope(next.json().pairingToken);
    const relink = await app.inject({
      body: nextEnvelope,
      headers: {
        ...simulatorHeaders,
        'x-secondlife-object-key': nextEnvelope.deviceId,
      },
      method: 'POST',
      url: '/secondlife/v1/avatar-pairings/claim',
    });
    expect(relink.json().code).toBe('REACTIVATED');
    const audits = await database.client.unsafe<Array<{ metadata: unknown }>>(
      "select metadata from audit_logs where action like 'avatar_%'",
    );
    expect(JSON.stringify(audits)).not.toContain(created.json().pairingToken);
    expect(JSON.stringify(audits)).not.toContain(next.json().pairingToken);
  });

  it('enforces role authorization and workspace isolation', async () => {
    const owner = await register();
    const onboarding = await onboard(owner);
    const workspaceId = onboarding.json().workspace.id as string;
    const second = await register({
      ...registration,
      email: 'support@example.com',
    });
    const [user] = await database.client.unsafe<Array<{ id: string }>>(
      "select id from users where email_normalized='support@example.com'",
    );
    if (!user) {
      throw new Error('Expected registered support user');
    }
    await database.client.unsafe(
      "insert into workspace_members(workspace_id,user_id,role,status,joined_at) values ($1,$2,'support','active',now())",
      [workspaceId, user.id],
    );
    const denied = await app.inject({
      headers: { cookie: cookieFrom(second), origin },
      method: 'POST',
      url: `/workspaces/${workspaceId}/avatar-pairings`,
    });
    expect(denied.statusCode).toBe(403);
    await database.client.unsafe(
      "update workspace_members set role='manager' where user_id=$1",
      [user.id],
    );
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(second), origin },
          method: 'POST',
          url: `/workspaces/${workspaceId}/avatar-pairings`,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          headers: { cookie: cookieFrom(second) },
          method: 'GET',
          url: `/workspaces/${randomUUID()}/avatars`,
        })
      ).statusCode,
    ).toBe(403);
  });

  it('rejects cancelled, expired, malformed, mismatched, and cross-avatar claims', async () => {
    const registered = await register();
    const onboarding = await onboard(registered);
    const workspaceId = onboarding.json().workspace.id as string;
    const make = () =>
      app.inject({
        headers: { cookie: cookieFrom(registered), origin },
        method: 'POST',
        url: `/workspaces/${workspaceId}/avatar-pairings`,
      });
    const cancelled = await make();
    await app.inject({
      headers: { cookie: cookieFrom(registered), origin },
      method: 'DELETE',
      url: `/workspaces/${workspaceId}/avatar-pairings/${cancelled.json().challengeId}`,
    });
    const cancelledEnvelope = claimEnvelope(cancelled.json().pairingToken);
    const headers = {
      'content-type': 'application/json',
      'x-secondlife-object-key': cancelledEnvelope.deviceId,
      'x-secondlife-owner-key': randomUUID(),
    };
    expect(
      (
        await app.inject({
          body: cancelledEnvelope,
          headers,
          method: 'POST',
          url: '/secondlife/v1/avatar-pairings/claim',
        })
      ).statusCode,
    ).toBe(410);
    const expired = await make();
    await database.client.unsafe(
      "update avatar_pairing_challenges set expires_at=now()-interval '1 second' where id=$1",
      [expired.json().challengeId],
    );
    const expiredEnvelope = claimEnvelope(expired.json().pairingToken);
    expect(
      (
        await app.inject({
          body: expiredEnvelope,
          headers: {
            ...headers,
            'x-secondlife-object-key': expiredEnvelope.deviceId,
          },
          method: 'POST',
          url: '/secondlife/v1/avatar-pairings/claim',
        })
      ).statusCode,
    ).toBe(410);
    expect(
      (
        await app.inject({
          body: expiredEnvelope,
          headers: { 'content-type': 'application/json' },
          method: 'POST',
          url: '/secondlife/v1/avatar-pairings/claim',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          body: expiredEnvelope,
          headers: { ...headers, 'x-secondlife-object-key': randomUUID() },
          method: 'POST',
          url: '/secondlife/v1/avatar-pairings/claim',
        })
      ).json().code,
    ).toBe('PROTOCOL_DEVICE_MISMATCH');
  });

  it('enforces the claim body limit on actual JSON bytes without trusting Content-Length', async () => {
    const pairingToken = 'Z'.repeat(32);
    const envelope = claimEnvelope(pairingToken);
    const response = await app.inject({
      headers: {
        'content-type': 'application/json',
        'x-secondlife-object-key': envelope.deviceId,
        'x-secondlife-owner-key': randomUUID(),
      },
      method: 'POST',
      payload: JSON.stringify({
        ...envelope,
        payload: { pairingToken, padding: 'x'.repeat(8192) },
      }),
      url: '/secondlife/v1/avatar-pairings/claim',
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().code).toBe('PROTOCOL_BODY_TOO_LARGE');
    expect(response.body).not.toContain(pairingToken);
    expect(response.body).not.toContain('padding');
  });

  it('rejects non-JSON claim requests with a stable safe response', async () => {
    const response = await app.inject({
      headers: {
        'content-type': 'text/plain',
        'x-secondlife-object-key': randomUUID(),
        'x-secondlife-owner-key': randomUUID(),
      },
      method: 'POST',
      payload: 'not-json',
      url: '/secondlife/v1/avatar-pairings/claim',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('PROTOCOL_JSON_REQUIRED');
    expect(response.body).not.toContain('not-json');
  });

  it('keeps invalid pairing-token protocol failures generic', async () => {
    const pairingToken = 'not-a-valid-token';
    const envelope = claimEnvelope(pairingToken);
    const response = await app.inject({
      body: envelope,
      headers: {
        'content-type': 'application/json',
        'x-secondlife-object-key': envelope.deviceId,
        'x-secondlife-owner-key': randomUUID(),
      },
      method: 'POST',
      url: '/secondlife/v1/avatar-pairings/claim',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('PROTOCOL_INVALID');
    expect(response.body).not.toContain(pairingToken);
  });

  it('rate limits public claims with private bounded Redis keys and Retry-After', async () => {
    const pairingToken = 'I'.repeat(32);
    const envelope = claimEnvelope(pairingToken);
    const headers = {
      'content-type': 'application/json',
      'x-secondlife-object-key': envelope.deviceId,
      'x-secondlife-owner-key': randomUUID(),
    };
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect(
        (
          await app.inject({
            body: {
              ...envelope,
              messageId: randomUUID(),
              sentAt: new Date().toISOString(),
            },
            headers,
            method: 'POST',
            url: '/secondlife/v1/avatar-pairings/claim',
          })
        ).statusCode,
      ).toBe(404);
    const limited = await app.inject({
      body: {
        ...envelope,
        messageId: randomUUID(),
        sentAt: new Date().toISOString(),
      },
      headers,
      method: 'POST',
      url: '/secondlife/v1/avatar-pairings/claim',
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().code).toBe('PAIRING_RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    const keys = await redis.keys('novavend:pairing:*');
    expect(keys.join(' ')).not.toContain(pairingToken);
    expect(
      (await Promise.all(keys.map((key) => redis.ttl(key)))).every(
        (ttl) => ttl > 0,
      ),
    ).toBe(true);
  });

  it('fails closed when pairing rate-limit Redis is unavailable', async () => {
    const appRedis = app.get<Redis>(REDIS_RESOURCE);
    appRedis.disconnect();
    const envelope = claimEnvelope('U'.repeat(32));
    const response = await app.inject({
      body: envelope,
      headers: {
        'content-type': 'application/json',
        'x-secondlife-object-key': envelope.deviceId,
        'x-secondlife-owner-key': randomUUID(),
      },
      method: 'POST',
      url: '/secondlife/v1/avatar-pairings/claim',
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().code).toBe('PAIRING_RATE_LIMIT_UNAVAILABLE');
  });
});
