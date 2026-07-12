import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AuditLogRepository,
  AvatarRepository,
  IdempotencyRepository,
  UserRepository,
  WorkspaceRepository,
  createDatabase,
  hashIdempotencyKey,
  hashRequestPayload,
} from './index';

const connection = createDatabase(
  process.env.DATABASE_URL ??
    'postgresql://novavend:novavend@127.0.0.1:5432/novavend',
);
const users = new UserRepository(connection.database);
const workspaces = new WorkspaceRepository(connection.database);
const avatars = new AvatarRepository(connection.database);
const audits = new AuditLogRepository(connection.database);
const idempotency = new IdempotencyRepository(connection.database);
let sequence = 0;

const createActiveUser = async () => {
  sequence += 1;
  const result = await users.createUser({
    email: `merchant-${sequence}@example.com`,
    status: 'active',
  });
  if (!result.ok)
    throw new Error(`Unexpected user conflict: ${result.conflict}`);
  return result.value;
};

const createWorkspace = async (ownerId: string, slug?: string) => {
  sequence += 1;
  const result = await workspaces.createWorkspaceWithOwner({
    createdByUserId: ownerId,
    name: `Workspace ${sequence}`,
    slug: slug ?? `workspace-${sequence}`,
  });
  if (!result.ok)
    throw new Error(`Unexpected workspace conflict: ${result.conflict}`);
  return result.value;
};

describe('core tenancy PostgreSQL integration', () => {
  beforeAll(async () => {
    await connection.checkConnectivity();
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    sequence = 0;
    await connection.client.unsafe(`
      truncate table
        audit_logs,
        idempotency_records,
        workspace_avatar_accounts,
        workspace_members,
        avatar_accounts,
        workspaces,
        users
      restart identity cascade
    `);
  });

  it('has applied the migration to an initially empty database', async () => {
    const rows = await connection.client.unsafe<{ table_name: string }[]>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'users', 'workspaces', 'workspace_members', 'avatar_accounts',
          'workspace_avatar_accounts', 'audit_logs', 'idempotency_records'
        )
    `);
    expect(rows.map((row) => row.table_name).sort()).toHaveLength(7);
  });

  it('enforces normalized email uniqueness', async () => {
    expect((await users.createUser({ email: 'Merchant@Example.com' })).ok).toBe(
      true,
    );
    expect(await users.createUser({ email: ' merchant@example.COM ' })).toEqual(
      {
        conflict: 'duplicate_email',
        ok: false,
      },
    );
  });

  it('enforces normalized workspace slug uniqueness', async () => {
    const firstOwner = await createActiveUser();
    const secondOwner = await createActiveUser();
    expect(
      (
        await workspaces.createWorkspaceWithOwner({
          createdByUserId: firstOwner.id,
          name: 'First',
          slug: 'Nova Vend',
        })
      ).ok,
    ).toBe(true);
    expect(
      await workspaces.createWorkspaceWithOwner({
        createdByUserId: secondOwner.id,
        name: 'Second',
        slug: 'nova-vend',
      }),
    ).toEqual({ conflict: 'duplicate_slug', ok: false });
  });

  it('creates a workspace and first owner atomically', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    expect(created.workspace.createdByUserId).toBe(owner.id);
    expect(created.member).toMatchObject({
      role: 'owner',
      status: 'active',
      userId: owner.id,
      workspaceId: created.workspace.id,
    });
  });

  it('rejects duplicate membership predictably', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    expect(
      await workspaces.addWorkspaceMember({
        role: 'viewer',
        status: 'active',
        userId: owner.id,
        workspaceId: created.workspace.id,
      }),
    ).toEqual({ conflict: 'duplicate_membership', ok: false });
  });

  it('does not demote the final active owner', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    expect(
      await workspaces.changeMemberRole(
        created.workspace.id,
        owner.id,
        'manager',
      ),
    ).toEqual({ conflict: 'final_active_owner', ok: false });
  });

  it('does not suspend the final active owner', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    expect(
      await workspaces.suspendWorkspaceMember(created.workspace.id, owner.id),
    ).toEqual({
      conflict: 'final_active_owner',
      ok: false,
    });
  });

  it('serializes concurrent owner demotions and allows exactly one of two owners', async () => {
    const firstOwner = await createActiveUser();
    const secondOwner = await createActiveUser();
    const created = await createWorkspace(firstOwner.id);
    expect(
      (
        await workspaces.addWorkspaceMember({
          role: 'owner',
          status: 'active',
          userId: secondOwner.id,
          workspaceId: created.workspace.id,
        })
      ).ok,
    ).toBe(true);

    const results = await Promise.all([
      workspaces.changeMemberRole(
        created.workspace.id,
        firstOwner.id,
        'manager',
      ),
      workspaces.changeMemberRole(
        created.workspace.id,
        secondOwner.id,
        'manager',
      ),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { conflict: 'final_active_owner', ok: false },
    ]);
  });

  it('links one global avatar UUID to multiple workspaces', async () => {
    const firstOwner = await createActiveUser();
    const secondOwner = await createActiveUser();
    const first = await createWorkspace(firstOwner.id);
    const second = await createWorkspace(secondOwner.id);
    const avatar = await avatars.upsertAvatarAccount({
      avatarUuid: randomUUID(),
    });
    expect(
      (await avatars.linkAvatar(first.workspace.id, avatar.id, firstOwner.id))
        .ok,
    ).toBe(true);
    expect(
      (await avatars.linkAvatar(second.workspace.id, avatar.id, secondOwner.id))
        .ok,
    ).toBe(true);
  });

  it('does not link the same avatar twice within a workspace', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    const avatar = await avatars.upsertAvatarAccount({
      avatarUuid: randomUUID(),
    });
    expect(
      (await avatars.linkAvatar(created.workspace.id, avatar.id, owner.id)).ok,
    ).toBe(true);
    expect(
      await avatars.linkAvatar(created.workspace.id, avatar.id, owner.id),
    ).toEqual({
      conflict: 'already_linked',
      ok: false,
    });
  });

  it('reactivates a revoked avatar link without a duplicate row', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    const avatar = await avatars.upsertAvatarAccount({
      avatarUuid: randomUUID(),
    });
    await avatars.linkAvatar(created.workspace.id, avatar.id, owner.id);
    expect(
      (await avatars.revokeAvatarLink(created.workspace.id, avatar.id)).ok,
    ).toBe(true);
    const reactivated = await avatars.linkAvatar(
      created.workspace.id,
      avatar.id,
      owner.id,
    );
    expect(reactivated.ok && reactivated.value.outcome).toBe('reactivated');
  });

  it('keeps workspace-scoped avatar reads isolated', async () => {
    const firstOwner = await createActiveUser();
    const secondOwner = await createActiveUser();
    const first = await createWorkspace(firstOwner.id);
    const second = await createWorkspace(secondOwner.id);
    const firstAvatar = await avatars.upsertAvatarAccount({
      avatarUuid: randomUUID(),
    });
    const secondAvatar = await avatars.upsertAvatarAccount({
      avatarUuid: randomUUID(),
    });
    await avatars.linkAvatar(first.workspace.id, firstAvatar.id, firstOwner.id);
    await avatars.linkAvatar(
      second.workspace.id,
      secondAvatar.id,
      secondOwner.id,
    );
    expect(
      (await avatars.listWorkspaceAvatars(first.workspace.id)).map(
        ({ id }) => id,
      ),
    ).toEqual([firstAvatar.id]);
  });

  it('appends and queries audit events by workspace', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    const correlationId = randomUUID();
    await audits.appendAuditEvent({
      action: 'workspace.created',
      actorUserId: owner.id,
      correlationId,
      entityId: created.workspace.id,
      entityType: 'workspace',
      metadata: { source: 'integration-test' },
      workspaceId: created.workspace.id,
    });
    const events = await audits.listWorkspaceAuditEvents(created.workspace.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      correlationId,
      workspaceId: created.workspace.id,
    });
  });

  it('claims and completes a first idempotency request using only hashes', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    const rawKey = 'raw-key-must-not-be-stored';
    const keyHash = hashIdempotencyKey(rawKey);
    const result = await idempotency.claimIdempotencyRecord({
      expiresAt: new Date(Date.now() + 60_000),
      keyHash,
      requestHash: hashRequestPayload('{"amount":10}'),
      scope: 'sale.create',
      workspaceId: created.workspace.id,
    });
    expect(result.kind).toBe('claimed');
    expect(result.record.keyHash).toBe(keyHash);
    expect(result.record.keyHash).not.toBe(rawKey);
    expect(
      (
        await idempotency.completeIdempotencyRecord(
          created.workspace.id,
          'sale.create',
          keyHash,
          201,
          { accepted: true },
        )
      ).ok,
    ).toBe(true);
  });

  it('recognizes a repeated matching idempotency request', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    const input = {
      expiresAt: new Date(Date.now() + 60_000),
      keyHash: hashIdempotencyKey('same-key'),
      requestHash: hashRequestPayload('same-request'),
      scope: 'operation',
      workspaceId: created.workspace.id,
    };
    expect((await idempotency.claimIdempotencyRecord(input)).kind).toBe(
      'claimed',
    );
    expect((await idempotency.claimIdempotencyRecord(input)).kind).toBe(
      'duplicate',
    );
  });

  it('reports conflicting idempotency-key reuse', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    const base = {
      expiresAt: new Date(Date.now() + 60_000),
      keyHash: hashIdempotencyKey('reused-key'),
      requestHash: hashRequestPayload('first-request'),
      scope: 'operation',
      workspaceId: created.workspace.id,
    };
    await idempotency.claimIdempotencyRecord(base);
    expect(
      (
        await idempotency.claimIdempotencyRecord({
          ...base,
          requestHash: hashRequestPayload('different-request'),
        })
      ).kind,
    ).toBe('conflict');
    expect(
      (
        await idempotency.failIdempotencyRecord(
          created.workspace.id,
          base.scope,
          base.keyHash,
          409,
        )
      ).ok,
    ).toBe(true);
  });

  it('removes expired idempotency records through maintenance', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id);
    await idempotency.claimIdempotencyRecord({
      expiresAt: new Date(Date.now() - 1_000),
      keyHash: hashIdempotencyKey('expired'),
      requestHash: hashRequestPayload('request'),
      scope: 'maintenance',
      workspaceId: created.workspace.id,
    });
    expect(await idempotency.deleteExpiredIdempotencyRecords()).toBe(1);
  });

  it('excludes soft-deleted users and workspaces from normal reads', async () => {
    const owner = await createActiveUser();
    const created = await createWorkspace(owner.id, 'soft-delete-test');
    expect((await users.softDeleteUser(owner.id)).ok).toBe(true);
    expect(
      (await workspaces.softDeleteWorkspace(created.workspace.id)).ok,
    ).toBe(true);
    expect(await users.findActiveUserByEmail(owner.email)).toBeUndefined();
    expect(
      await workspaces.findWorkspaceById(created.workspace.id),
    ).toBeUndefined();
    expect(
      await workspaces.findWorkspaceBySlug('soft-delete-test'),
    ).toBeUndefined();
  });
});
