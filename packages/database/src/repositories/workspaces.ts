import { and, count, eq, isNull, sql } from 'drizzle-orm';
import type { NovaVendDatabase } from '../index';
import {
  conflict,
  prepareWorkspaceSlug,
  success,
  type DomainResult,
} from '../domain';
import {
  workspaceMembers,
  workspaces,
  type Workspace,
  type WorkspaceMember,
} from '../schema';
import { isPostgresErrorCode, requireRow } from './shared';

export interface CreateWorkspaceInput {
  createdByUserId: string;
  name: string;
  slug: string;
}

export interface AddWorkspaceMemberInput {
  role: 'owner' | 'manager' | 'support' | 'viewer';
  status?: 'active' | 'invited' | 'suspended';
  userId: string;
  workspaceId: string;
}

export class WorkspaceRepository {
  constructor(private readonly database: NovaVendDatabase) {}

  async createWorkspaceWithOwner(
    input: CreateWorkspaceInput,
  ): Promise<
    DomainResult<
      { member: WorkspaceMember; workspace: Workspace },
      'duplicate_slug' | 'invalid_slug'
    >
  > {
    const slug = prepareWorkspaceSlug(input.slug);
    if (!slug.ok) return slug;
    try {
      return await this.database.transaction(async (transaction) => {
        const [workspace] = await transaction
          .insert(workspaces)
          .values({
            createdByUserId: input.createdByUserId,
            name: input.name,
            slug: slug.value,
          })
          .returning();
        const createdWorkspace = requireRow(workspace, 'create workspace');
        const [member] = await transaction
          .insert(workspaceMembers)
          .values({
            joinedAt: new Date(),
            role: 'owner',
            status: 'active',
            userId: input.createdByUserId,
            workspaceId: createdWorkspace.id,
          })
          .returning();
        return success({
          member: requireRow(member, 'create initial owner'),
          workspace: createdWorkspace,
        });
      });
    } catch (error) {
      if (isPostgresErrorCode(error, '23505'))
        return conflict('duplicate_slug');
      throw error;
    }
  }

  async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    const [workspace] = await this.database
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.status, 'active'),
          isNull(workspaces.deletedAt),
        ),
      )
      .limit(1);
    return workspace;
  }

  async findWorkspaceBySlug(slugInput: string): Promise<Workspace | undefined> {
    const slug = prepareWorkspaceSlug(slugInput);
    if (!slug.ok) return undefined;
    const [workspace] = await this.database
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.slug, slug.value),
          eq(workspaces.status, 'active'),
          isNull(workspaces.deletedAt),
        ),
      )
      .limit(1);
    return workspace;
  }

  async softDeleteWorkspace(
    workspaceId: string,
  ): Promise<DomainResult<Workspace, 'not_found'>> {
    const now = new Date();
    const [workspace] = await this.database
      .update(workspaces)
      .set({ deletedAt: now, status: 'deleted', updatedAt: now })
      .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)))
      .returning();
    return workspace ? success(workspace) : conflict('not_found');
  }

  async addWorkspaceMember(
    input: AddWorkspaceMemberInput,
  ): Promise<DomainResult<WorkspaceMember, 'duplicate_membership'>> {
    try {
      const [member] = await this.database
        .insert(workspaceMembers)
        .values({
          joinedAt: input.status === 'active' ? new Date() : null,
          role: input.role,
          status: input.status ?? 'invited',
          userId: input.userId,
          workspaceId: input.workspaceId,
        })
        .returning();
      return success(requireRow(member, 'add workspace member'));
    } catch (error) {
      if (isPostgresErrorCode(error, '23505'))
        return conflict('duplicate_membership');
      throw error;
    }
  }

  async findMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | undefined> {
    const [member] = await this.database
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    return member;
  }

  async changeMemberRole(
    workspaceId: string,
    userId: string,
    role: AddWorkspaceMemberInput['role'],
  ): Promise<
    DomainResult<WorkspaceMember, 'final_active_owner' | 'not_found'>
  > {
    return this.database.transaction(async (transaction) => {
      await this.lockWorkspace(transaction, workspaceId);
      const [member] = await transaction
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        )
        .limit(1);
      if (!member) return conflict('not_found');
      if (
        member.role === 'owner' &&
        member.status === 'active' &&
        role !== 'owner' &&
        (await this.countActiveOwners(transaction, workspaceId)) <= 1
      ) {
        return conflict('final_active_owner');
      }
      const [updated] = await transaction
        .update(workspaceMembers)
        .set({ role, updatedAt: new Date() })
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        )
        .returning();
      return success(requireRow(updated, 'change member role'));
    });
  }

  async suspendWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<
    DomainResult<WorkspaceMember, 'final_active_owner' | 'not_found'>
  > {
    return this.database.transaction(async (transaction) => {
      await this.lockWorkspace(transaction, workspaceId);
      const [member] = await transaction
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        )
        .limit(1);
      if (!member) return conflict('not_found');
      if (
        member.role === 'owner' &&
        member.status === 'active' &&
        (await this.countActiveOwners(transaction, workspaceId)) <= 1
      ) {
        return conflict('final_active_owner');
      }
      const [updated] = await transaction
        .update(workspaceMembers)
        .set({ status: 'suspended', updatedAt: new Date() })
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        )
        .returning();
      return success(requireRow(updated, 'suspend workspace member'));
    });
  }

  private async lockWorkspace(
    transaction: Parameters<Parameters<NovaVendDatabase['transaction']>[0]>[0],
    workspaceId: string,
  ): Promise<void> {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId}::text, 0))`,
    );
  }

  private async countActiveOwners(
    transaction: Parameters<Parameters<NovaVendDatabase['transaction']>[0]>[0],
    workspaceId: string,
  ): Promise<number> {
    const [result] = await transaction
      .select({ value: count() })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.role, 'owner'),
          eq(workspaceMembers.status, 'active'),
        ),
      );
    return Number(result?.value ?? 0);
  }
}
