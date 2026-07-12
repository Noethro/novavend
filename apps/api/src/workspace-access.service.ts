import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthenticationRepository } from '@novavend/database';
import {
  DATABASE_RESOURCE,
  type DatabaseResource,
} from './infrastructure.service';

export type WorkspaceRole = 'owner' | 'manager' | 'support' | 'viewer';
export const canManageAvatars = (role: WorkspaceRole): boolean =>
  role === 'owner' || role === 'manager';

@Injectable()
export class WorkspaceAccessService {
  private readonly repository: AuthenticationRepository;

  constructor(@Inject(DATABASE_RESOURCE) database: DatabaseResource) {
    this.repository = new AuthenticationRepository(database.database);
  }

  async requireMember(userId: string, workspaceId: string) {
    const membership = await this.repository.findActiveMembership(
      userId,
      workspaceId,
    );
    if (!membership)
      throw new ForbiddenException({
        error: 'WORKSPACE_ACCESS_DENIED',
        message: 'Workspace is unavailable',
      });
    return membership;
  }

  async requireManager(userId: string, workspaceId: string) {
    const membership = await this.requireMember(userId, workspaceId);
    if (!canManageAvatars(membership.role))
      throw new ForbiddenException({
        error: 'WORKSPACE_ACCESS_DENIED',
        message: 'Workspace is unavailable',
      });
    return membership;
  }
}
