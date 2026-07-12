import { and, eq } from 'drizzle-orm';
import type { NovaVendDatabase } from '../index';
import { conflict, success, type DomainResult } from '../domain';
import {
  avatarAccounts,
  workspaceAvatarAccounts,
  type AvatarAccount,
  type WorkspaceAvatarAccount,
} from '../schema';
import { requireRow } from './shared';

export class AvatarRepository {
  constructor(private readonly database: NovaVendDatabase) {}

  async upsertAvatarAccount(input: {
    avatarUuid: string;
    displayName?: string | null;
    legacyName?: string | null;
  }): Promise<AvatarAccount> {
    const [avatar] = await this.database
      .insert(avatarAccounts)
      .values(input)
      .onConflictDoUpdate({
        set: {
          displayName: input.displayName,
          legacyName: input.legacyName,
          updatedAt: new Date(),
        },
        target: avatarAccounts.avatarUuid,
      })
      .returning();
    return requireRow(avatar, 'upsert avatar account');
  }

  async linkAvatar(
    workspaceId: string,
    avatarAccountId: string,
    linkedByUserId: string,
  ): Promise<
    DomainResult<
      { link: WorkspaceAvatarAccount; outcome: 'linked' | 'reactivated' },
      'already_linked'
    >
  > {
    return this.database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(workspaceAvatarAccounts)
        .values({ avatarAccountId, linkedByUserId, workspaceId })
        .onConflictDoNothing()
        .returning();
      if (created)
        return success({ link: created, outcome: 'linked' as const });
      const [existing] = await transaction
        .select()
        .from(workspaceAvatarAccounts)
        .where(
          and(
            eq(workspaceAvatarAccounts.workspaceId, workspaceId),
            eq(workspaceAvatarAccounts.avatarAccountId, avatarAccountId),
          ),
        )
        .limit(1);
      if (!existing || existing.status === 'active')
        return conflict('already_linked');
      const [reactivated] = await transaction
        .update(workspaceAvatarAccounts)
        .set({
          linkedAt: new Date(),
          linkedByUserId,
          revokedAt: null,
          status: 'active',
        })
        .where(
          and(
            eq(workspaceAvatarAccounts.workspaceId, workspaceId),
            eq(workspaceAvatarAccounts.avatarAccountId, avatarAccountId),
          ),
        )
        .returning();
      return success({
        link: requireRow(reactivated, 'reactivate avatar link'),
        outcome: 'reactivated' as const,
      });
    });
  }

  async revokeAvatarLink(
    workspaceId: string,
    avatarAccountId: string,
  ): Promise<DomainResult<WorkspaceAvatarAccount, 'not_found'>> {
    const [link] = await this.database
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
    return link ? success(link) : conflict('not_found');
  }

  async listWorkspaceAvatars(workspaceId: string): Promise<AvatarAccount[]> {
    const rows = await this.database
      .select({ avatar: avatarAccounts })
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
    return rows.map((row) => row.avatar);
  }
}
