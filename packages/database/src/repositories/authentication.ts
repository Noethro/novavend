import { and, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { NovaVendDatabase } from '../index';
import { normalizeEmail, prepareWorkspaceSlug } from '../domain';
import {
  auditLogs,
  userPasswordCredentials,
  userSessions,
  users,
  workspaceMembers,
  workspaces,
  type User,
  type UserSession,
  type Workspace,
} from '../schema';
import { isPostgresErrorCode, requireRow } from './shared';

export type RegistrationResult =
  { ok: true; user: User } | { ok: false; reason: 'duplicate_email' };

export type OnboardingResult =
  | { ok: true; workspace: Workspace }
  | {
      ok: false;
      reason:
        | 'already_onboarded'
        | 'duplicate_slug'
        | 'invalid_slug'
        | 'user_unavailable';
    };

export interface ResolvedSession {
  session: UserSession;
  user: User;
}

export class AuthenticationRepository {
  constructor(private readonly database: NovaVendDatabase) {}

  async register(input: {
    displayName: string;
    email: string;
    passwordHash: string;
    correlationId?: string;
  }): Promise<RegistrationResult> {
    const emailNormalized = normalizeEmail(input.email);
    try {
      return await this.database.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({
            displayName: input.displayName,
            email: input.email,
            emailNormalized,
            status: 'pending',
          })
          .returning();
        const created = requireRow(user, 'register user');
        await transaction.insert(userPasswordCredentials).values({
          passwordHash: input.passwordHash,
          userId: created.id,
        });
        await transaction.insert(auditLogs).values({
          action: 'auth.user_registered',
          actorUserId: created.id,
          correlationId: input.correlationId,
          entityId: created.id,
          entityType: 'user',
          metadata: {},
        });
        return { ok: true as const, user: created };
      });
    } catch (error) {
      if (isPostgresErrorCode(error, '23505')) {
        return { ok: false, reason: 'duplicate_email' };
      }
      throw error;
    }
  }

  async findCredential(
    email: string,
  ): Promise<{ passwordHash: string; user: User } | undefined> {
    const [row] = await this.database
      .select({
        passwordHash: userPasswordCredentials.passwordHash,
        user: users,
      })
      .from(users)
      .innerJoin(
        userPasswordCredentials,
        eq(userPasswordCredentials.userId, users.id),
      )
      .where(
        and(
          eq(users.emailNormalized, normalizeEmail(email)),
          inArray(users.status, ['pending', 'active']),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return row;
  }

  async createSession(input: {
    expiresAt: Date;
    tokenHash: string;
    userId: string;
  }): Promise<UserSession> {
    const [session] = await this.database
      .insert(userSessions)
      .values(input)
      .returning();
    return requireRow(session, 'create session');
  }

  async resolveSession(
    tokenHash: string,
    now = new Date(),
  ): Promise<ResolvedSession | undefined> {
    const [resolved] = await this.database
      .select({ session: userSessions, user: users })
      .from(userSessions)
      .innerJoin(users, eq(users.id, userSessions.userId))
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now),
          inArray(users.status, ['pending', 'active']),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return resolved;
  }

  async touchSession(sessionId: string, now = new Date()): Promise<void> {
    await this.database
      .update(userSessions)
      .set({ lastSeenAt: now })
      .where(eq(userSessions.id, sessionId));
  }

  async revokeSession(
    tokenHash: string,
    now = new Date(),
  ): Promise<UserSession | undefined> {
    const [session] = await this.database
      .update(userSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          isNull(userSessions.revokedAt),
        ),
      )
      .returning();
    return session;
  }

  async listMemberships(userId: string) {
    return this.database
      .select({
        role: workspaceMembers.role,
        status: workspaceMembers.status,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'active'),
          eq(workspaces.status, 'active'),
          isNull(workspaces.deletedAt),
        ),
      );
  }

  async findActiveMembership(userId: string, workspaceId: string) {
    const [membership] = await this.database
      .select({ role: workspaceMembers.role, status: workspaceMembers.status })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.status, 'active'),
          eq(workspaces.status, 'active'),
          isNull(workspaces.deletedAt),
        ),
      )
      .limit(1);
    return membership;
  }

  async onboardFirstWorkspace(input: {
    correlationId?: string;
    name: string;
    slug: string;
    userId: string;
  }): Promise<OnboardingResult> {
    const preparedSlug = prepareWorkspaceSlug(input.slug);
    if (!preparedSlug.ok) return { ok: false, reason: 'invalid_slug' };
    try {
      return await this.database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${input.userId}::text, 1))`,
        );
        const [user] = await transaction
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, input.userId),
              inArray(users.status, ['pending', 'active']),
              isNull(users.deletedAt),
            ),
          )
          .limit(1);
        if (!user)
          return { ok: false as const, reason: 'user_unavailable' as const };
        const [existing] = await transaction
          .select({ workspaceId: workspaceMembers.workspaceId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.userId, input.userId),
              eq(workspaceMembers.status, 'active'),
            ),
          )
          .limit(1);
        if (existing)
          return { ok: false as const, reason: 'already_onboarded' as const };
        const [workspace] = await transaction
          .insert(workspaces)
          .values({
            createdByUserId: input.userId,
            name: input.name,
            slug: preparedSlug.value,
          })
          .returning();
        const created = requireRow(workspace, 'onboard workspace');
        await transaction.insert(workspaceMembers).values({
          joinedAt: new Date(),
          role: 'owner',
          status: 'active',
          userId: input.userId,
          workspaceId: created.id,
        });
        await transaction
          .update(users)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(users.id, input.userId));
        await transaction.insert(auditLogs).values({
          action: 'onboarding.workspace_created',
          actorUserId: input.userId,
          correlationId: input.correlationId,
          entityId: created.id,
          entityType: 'workspace',
          metadata: {},
          workspaceId: created.id,
        });
        return { ok: true as const, workspace: created };
      });
    } catch (error) {
      if (isPostgresErrorCode(error, '23505')) {
        return { ok: false, reason: 'duplicate_slug' };
      }
      throw error;
    }
  }

  async appendAuthAudit(input: {
    action: string;
    correlationId?: string;
    userId: string;
  }): Promise<void> {
    await this.database.insert(auditLogs).values({
      action: input.action,
      actorUserId: input.userId,
      correlationId: input.correlationId,
      entityId: input.userId,
      entityType: 'user',
      metadata: {},
    });
  }

  async deleteExpiredOrRevokedSessions(now = new Date()): Promise<number> {
    const removed = await this.database
      .delete(userSessions)
      .where(
        or(
          lt(userSessions.expiresAt, now),
          sql`${userSessions.revokedAt} is not null`,
        ),
      )
      .returning({ id: userSessions.id });
    return removed.length;
  }
}
