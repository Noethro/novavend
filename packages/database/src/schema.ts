import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const userStatusEnum = pgEnum('user_status', [
  'pending',
  'active',
  'suspended',
  'deleted',
]);
export const workspaceStatusEnum = pgEnum('workspace_status', [
  'active',
  'suspended',
  'deleted',
]);
export const workspaceMemberRoleEnum = pgEnum('workspace_member_role', [
  'owner',
  'manager',
  'support',
  'viewer',
]);
export const workspaceMemberStatusEnum = pgEnum('workspace_member_status', [
  'active',
  'invited',
  'suspended',
]);
export const workspaceAvatarStatusEnum = pgEnum('workspace_avatar_status', [
  'active',
  'revoked',
]);
export const idempotencyStatusEnum = pgEnum('idempotency_status', [
  'in_progress',
  'completed',
  'failed',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    emailNormalized: text('email_normalized').notNull(),
    displayName: text('display_name'),
    status: userStatusEnum('status').default('pending').notNull(),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_normalized_unique').on(table.emailNormalized),
  ],
);

export const userPasswordCredentials = pgTable('user_password_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
  passwordHash: text('password_hash').notNull(),
  passwordUpdatedAt: timestamp('password_updated_at', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    uniqueIndex('user_sessions_token_hash_unique').on(table.tokenHash),
    index('user_sessions_active_lookup_idx').on(
      table.tokenHash,
      table.expiresAt,
      table.revokedAt,
    ),
    index('user_sessions_user_idx').on(table.userId),
    index('user_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: workspaceStatusEnum('status').default('active').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    uniqueIndex('workspaces_slug_unique').on(table.slug),
    index('workspaces_created_by_user_idx').on(table.createdByUserId),
  ],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    role: workspaceMemberRoleEnum('role').notNull(),
    status: workspaceMemberStatusEnum('status').default('invited').notNull(),
    joinedAt: timestamp('joined_at', { mode: 'date', withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId],
      name: 'workspace_members_pk',
    }),
    index('workspace_members_workspace_idx').on(table.workspaceId),
    index('workspace_members_user_idx').on(table.userId),
  ],
);

export const avatarAccounts = pgTable(
  'avatar_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    avatarUuid: uuid('avatar_uuid').notNull(),
    displayName: text('display_name'),
    legacyName: text('legacy_name'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('avatar_accounts_avatar_uuid_unique').on(table.avatarUuid),
  ],
);

export const workspaceAvatarAccounts = pgTable(
  'workspace_avatar_accounts',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    avatarAccountId: uuid('avatar_account_id')
      .notNull()
      .references(() => avatarAccounts.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    linkedByUserId: uuid('linked_by_user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    status: workspaceAvatarStatusEnum('status').default('active').notNull(),
    linkedAt: timestamp('linked_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.avatarAccountId],
      name: 'workspace_avatar_accounts_pk',
    }),
    index('workspace_avatar_accounts_workspace_status_idx').on(
      table.workspaceId,
      table.status,
    ),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    actorAvatarAccountId: uuid('actor_avatar_account_id').references(
      () => avatarAccounts.id,
      { onDelete: 'set null', onUpdate: 'cascade' },
    ),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    correlationId: uuid('correlation_id'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('audit_logs_workspace_created_idx').on(
      table.workspaceId,
      table.createdAt,
    ),
    index('audit_logs_actor_user_created_idx').on(
      table.actorUserId,
      table.createdAt,
    ),
  ],
);

export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    scope: text('scope').notNull(),
    keyHash: text('key_hash').notNull(),
    requestHash: text('request_hash').notNull(),
    status: idempotencyStatusEnum('status').default('in_progress').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idempotency_records_workspace_scope_key_unique').on(
      table.workspaceId,
      table.scope,
      table.keyHash,
    ),
    index('idempotency_records_expires_at_idx').on(table.expiresAt),
  ],
);

export const schema = {
  auditLogs,
  avatarAccounts,
  idempotencyRecords,
  users,
  userPasswordCredentials,
  userSessions,
  workspaceAvatarAccounts,
  workspaceMembers,
  workspaces,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserPasswordCredential =
  typeof userPasswordCredentials.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type AvatarAccount = typeof avatarAccounts.$inferSelect;
export type WorkspaceAvatarAccount =
  typeof workspaceAvatarAccounts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type IdempotencyRecord = typeof idempotencyRecords.$inferSelect;
