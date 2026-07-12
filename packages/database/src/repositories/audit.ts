import { desc, eq } from 'drizzle-orm';
import type { NovaVendDatabase } from '../index';
import { auditLogs, type AuditLog } from '../schema';
import { requireRow } from './shared';

export interface AppendAuditEventInput {
  action: string;
  actorAvatarAccountId?: string | null;
  actorUserId?: string | null;
  correlationId?: string | null;
  entityId?: string | null;
  entityType: string;
  metadata?: Record<string, unknown>;
  workspaceId?: string | null;
}

export class AuditLogRepository {
  constructor(private readonly database: NovaVendDatabase) {}

  async appendAuditEvent(input: AppendAuditEventInput): Promise<AuditLog> {
    const [event] = await this.database
      .insert(auditLogs)
      .values(input)
      .returning();
    return requireRow(event, 'append audit event');
  }

  async listWorkspaceAuditEvents(
    workspaceId: string,
    limit = 100,
  ): Promise<AuditLog[]> {
    return this.database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.workspaceId, workspaceId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(Math.min(limit, 500));
  }
}
