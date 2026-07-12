import { and, eq, lt, sql } from 'drizzle-orm';
import type { NovaVendDatabase } from '../index';
import {
  auditLogs,
  avatarAccounts,
  avatarPairingChallenges,
  workspaceAvatarAccounts,
  type AvatarPairingChallenge,
} from '../schema';
import { isPostgresErrorCode, requireRow } from './shared';

export type PairingClaimResult =
  | {
      ok: true;
      avatarAccountId: string;
      outcome: 'linked' | 'reactivated' | 'replayed';
      workspaceId: string;
    }
  | { ok: false; reason: 'cancelled' | 'consumed' | 'expired' | 'invalid' };

export class AvatarPairingRepository {
  constructor(private readonly database: NovaVendDatabase) {}

  async create(input: {
    correlationId?: string;
    createdByUserId: string;
    expiresAt: Date;
    maxPending: number;
    tokenHash: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; challenge: AvatarPairingChallenge }
    | { ok: false; reason: 'too_many_pending' }
  > {
    return this.database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}::text || ${input.createdByUserId}::text, 5))`,
      );
      await transaction
        .update(avatarPairingChallenges)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(
          and(
            eq(avatarPairingChallenges.workspaceId, input.workspaceId),
            eq(avatarPairingChallenges.status, 'pending'),
            lt(avatarPairingChallenges.expiresAt, new Date()),
          ),
        );
      const count = await transaction.$count(
        avatarPairingChallenges,
        and(
          eq(avatarPairingChallenges.workspaceId, input.workspaceId),
          eq(avatarPairingChallenges.createdByUserId, input.createdByUserId),
          eq(avatarPairingChallenges.status, 'pending'),
        ),
      );
      if (count >= input.maxPending)
        return { ok: false as const, reason: 'too_many_pending' as const };
      const [challenge] = await transaction
        .insert(avatarPairingChallenges)
        .values(input)
        .returning();
      const created = requireRow(challenge, 'create avatar pairing challenge');
      await transaction.insert(auditLogs).values({
        action: 'avatar_pairing.created',
        actorUserId: input.createdByUserId,
        correlationId: input.correlationId,
        entityId: created.id,
        entityType: 'avatar_pairing_challenge',
        metadata: {},
        workspaceId: input.workspaceId,
      });
      return { ok: true as const, challenge: created };
    });
  }

  async find(workspaceId: string, challengeId: string) {
    await this.expirePending(new Date(), workspaceId);
    const [row] = await this.database
      .select({ challenge: avatarPairingChallenges, avatar: avatarAccounts })
      .from(avatarPairingChallenges)
      .leftJoin(
        avatarAccounts,
        eq(avatarAccounts.id, avatarPairingChallenges.claimedAvatarAccountId),
      )
      .where(
        and(
          eq(avatarPairingChallenges.id, challengeId),
          eq(avatarPairingChallenges.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    return row;
  }

  async cancel(
    workspaceId: string,
    challengeId: string,
    userId: string,
    correlationId?: string,
  ) {
    return this.database.transaction(async (transaction) => {
      const [cancelled] = await transaction
        .update(avatarPairingChallenges)
        .set({
          cancelledAt: new Date(),
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(avatarPairingChallenges.id, challengeId),
            eq(avatarPairingChallenges.workspaceId, workspaceId),
            eq(avatarPairingChallenges.status, 'pending'),
          ),
        )
        .returning();
      if (cancelled)
        await transaction.insert(auditLogs).values({
          action: 'avatar_pairing.cancelled',
          actorUserId: userId,
          correlationId,
          entityId: cancelled.id,
          entityType: 'avatar_pairing_challenge',
          metadata: {},
          workspaceId,
        });
      const existing =
        cancelled ??
        (await transaction.query.avatarPairingChallenges.findFirst({
          where: and(
            eq(avatarPairingChallenges.id, challengeId),
            eq(avatarPairingChallenges.workspaceId, workspaceId),
          ),
        }));
      return existing
        ? { ok: true as const, challenge: existing }
        : { ok: false as const, reason: 'not_found' as const };
    });
  }

  async claim(input: {
    avatarUuid: string;
    displayName?: string;
    messageId: string;
    tokenHash: string;
  }): Promise<PairingClaimResult> {
    try {
      return await this.database.transaction(async (transaction) => {
        const rows = await transaction.execute(
          sql`select * from avatar_pairing_challenges where token_hash = ${input.tokenHash} for update`,
        );
        const raw = rows[0] as Record<string, unknown> | undefined;
        if (!raw) return { ok: false, reason: 'invalid' };
        const status = String(raw.status);
        const challengeId = String(raw.id);
        const workspaceId = String(raw.workspace_id);
        if (status === 'claimed') {
          const [avatar] = await transaction
            .select()
            .from(avatarAccounts)
            .where(eq(avatarAccounts.id, String(raw.claimed_avatar_account_id)))
            .limit(1);
          if (
            avatar?.avatarUuid === input.avatarUuid &&
            raw.claimed_message_id === input.messageId
          )
            return {
              ok: true,
              avatarAccountId: avatar.id,
              outcome: 'replayed',
              workspaceId,
            };
          return { ok: false, reason: 'consumed' };
        }
        if (status === 'cancelled') return { ok: false, reason: 'cancelled' };
        if (
          status === 'expired' ||
          new Date(String(raw.expires_at)) <= new Date()
        ) {
          if (status === 'pending')
            await transaction
              .update(avatarPairingChallenges)
              .set({ status: 'expired', updatedAt: new Date() })
              .where(eq(avatarPairingChallenges.id, challengeId));
          return { ok: false, reason: 'expired' };
        }
        const [avatar] = await transaction
          .insert(avatarAccounts)
          .values({
            avatarUuid: input.avatarUuid,
            displayName: input.displayName,
          })
          .onConflictDoUpdate({
            target: avatarAccounts.avatarUuid,
            set: { displayName: input.displayName, updatedAt: new Date() },
          })
          .returning();
        const account = requireRow(avatar, 'claim avatar account');
        const [prior] = await transaction
          .select()
          .from(workspaceAvatarAccounts)
          .where(
            and(
              eq(workspaceAvatarAccounts.workspaceId, workspaceId),
              eq(workspaceAvatarAccounts.avatarAccountId, account.id),
            ),
          )
          .limit(1);
        await transaction
          .insert(workspaceAvatarAccounts)
          .values({
            avatarAccountId: account.id,
            linkedByUserId: String(raw.created_by_user_id),
            workspaceId,
          })
          .onConflictDoUpdate({
            target: [
              workspaceAvatarAccounts.workspaceId,
              workspaceAvatarAccounts.avatarAccountId,
            ],
            set: {
              linkedAt: new Date(),
              linkedByUserId: String(raw.created_by_user_id),
              revokedAt: null,
              status: 'active',
            },
          });
        await transaction
          .update(avatarPairingChallenges)
          .set({
            claimedAt: new Date(),
            claimedAvatarAccountId: account.id,
            claimedMessageId: input.messageId,
            status: 'claimed',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(avatarPairingChallenges.id, challengeId),
              eq(avatarPairingChallenges.status, 'pending'),
            ),
          );
        await transaction.insert(auditLogs).values({
          action:
            prior?.status === 'revoked'
              ? 'avatar_link.reactivated'
              : 'avatar_link.created',
          actorAvatarAccountId: account.id,
          entityId: account.id,
          entityType: 'avatar_account',
          correlationId: input.messageId,
          metadata: {},
          workspaceId,
        });
        return {
          ok: true,
          avatarAccountId: account.id,
          outcome: prior?.status === 'revoked' ? 'reactivated' : 'linked',
          workspaceId,
        };
      });
    } catch (error) {
      if (isPostgresErrorCode(error, '23505'))
        return { ok: false, reason: 'consumed' };
      throw error;
    }
  }

  async expirePending(now = new Date(), workspaceId?: string): Promise<number> {
    const conditions = [
      eq(avatarPairingChallenges.status, 'pending'),
      lt(avatarPairingChallenges.expiresAt, now),
    ];
    if (workspaceId)
      conditions.push(eq(avatarPairingChallenges.workspaceId, workspaceId));
    const rows = await this.database
      .update(avatarPairingChallenges)
      .set({ status: 'expired', updatedAt: now })
      .where(and(...conditions))
      .returning({ id: avatarPairingChallenges.id });
    return rows.length;
  }

  async listAvatars(workspaceId: string) {
    return this.database
      .select({
        id: avatarAccounts.id,
        avatarUuid: avatarAccounts.avatarUuid,
        displayName: avatarAccounts.displayName,
        legacyName: avatarAccounts.legacyName,
        linkedAt: workspaceAvatarAccounts.linkedAt,
      })
      .from(workspaceAvatarAccounts)
      .innerJoin(
        avatarAccounts,
        eq(avatarAccounts.id, workspaceAvatarAccounts.avatarAccountId),
      )
      .where(
        and(
          eq(workspaceAvatarAccounts.workspaceId, workspaceId),
          eq(workspaceAvatarAccounts.status, 'active'),
        ),
      );
  }

  async revoke(
    workspaceId: string,
    avatarAccountId: string,
    userId: string,
    correlationId?: string,
  ) {
    return this.database.transaction(async (transaction) => {
      const [link] = await transaction
        .update(workspaceAvatarAccounts)
        .set({ revokedAt: new Date(), status: 'revoked' })
        .where(
          and(
            eq(workspaceAvatarAccounts.workspaceId, workspaceId),
            eq(workspaceAvatarAccounts.avatarAccountId, avatarAccountId),
            eq(workspaceAvatarAccounts.status, 'active'),
          ),
        )
        .returning();
      if (!link) return { ok: false as const, reason: 'not_found' as const };
      await transaction.insert(auditLogs).values({
        action: 'avatar_link.revoked',
        actorUserId: userId,
        correlationId,
        entityId: avatarAccountId,
        entityType: 'avatar_account',
        metadata: {},
        workspaceId,
      });
      return { ok: true as const };
    });
  }
}
