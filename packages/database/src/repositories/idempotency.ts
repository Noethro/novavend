import { and, eq, lt } from 'drizzle-orm';
import type { NovaVendDatabase } from '../index';
import {
  compareIdempotencyRequestHashes,
  conflict,
  success,
  type DomainResult,
} from '../domain';
import { idempotencyRecords, type IdempotencyRecord } from '../schema';
import { requireRow } from './shared';

export type IdempotencyClaimResult =
  | { kind: 'claimed'; record: IdempotencyRecord }
  | { kind: 'duplicate'; record: IdempotencyRecord }
  | { kind: 'conflict'; record: IdempotencyRecord };

export class IdempotencyRepository {
  constructor(private readonly database: NovaVendDatabase) {}

  async claimIdempotencyRecord(input: {
    expiresAt: Date;
    keyHash: string;
    requestHash: string;
    scope: string;
    workspaceId: string;
  }): Promise<IdempotencyClaimResult> {
    const [created] = await this.database
      .insert(idempotencyRecords)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (created) return { kind: 'claimed', record: created };
    const existing = await this.findIdempotencyRecord(
      input.workspaceId,
      input.scope,
      input.keyHash,
    );
    const record = requireRow(existing, 'read duplicate idempotency record');
    const comparison = compareIdempotencyRequestHashes(
      record.requestHash,
      input.requestHash,
    );
    return { kind: comparison.ok ? 'duplicate' : 'conflict', record };
  }

  async findIdempotencyRecord(
    workspaceId: string,
    scope: string,
    keyHash: string,
  ): Promise<IdempotencyRecord | undefined> {
    const [record] = await this.database
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.workspaceId, workspaceId),
          eq(idempotencyRecords.scope, scope),
          eq(idempotencyRecords.keyHash, keyHash),
        ),
      )
      .limit(1);
    return record;
  }

  async completeIdempotencyRecord(
    workspaceId: string,
    scope: string,
    keyHash: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<DomainResult<IdempotencyRecord, 'not_found'>> {
    return this.finishRecord(
      workspaceId,
      scope,
      keyHash,
      'completed',
      responseStatus,
      responseBody,
    );
  }

  async failIdempotencyRecord(
    workspaceId: string,
    scope: string,
    keyHash: string,
    responseStatus?: number,
    responseBody?: unknown,
  ): Promise<DomainResult<IdempotencyRecord, 'not_found'>> {
    return this.finishRecord(
      workspaceId,
      scope,
      keyHash,
      'failed',
      responseStatus,
      responseBody,
    );
  }

  async deleteExpiredIdempotencyRecords(
    expiresBefore = new Date(),
  ): Promise<number> {
    const deleted = await this.database
      .delete(idempotencyRecords)
      .where(lt(idempotencyRecords.expiresAt, expiresBefore))
      .returning({ id: idempotencyRecords.id });
    return deleted.length;
  }

  private async finishRecord(
    workspaceId: string,
    scope: string,
    keyHash: string,
    status: 'completed' | 'failed',
    responseStatus?: number,
    responseBody?: unknown,
  ): Promise<DomainResult<IdempotencyRecord, 'not_found'>> {
    const [record] = await this.database
      .update(idempotencyRecords)
      .set({ responseBody, responseStatus, status, updatedAt: new Date() })
      .where(
        and(
          eq(idempotencyRecords.workspaceId, workspaceId),
          eq(idempotencyRecords.scope, scope),
          eq(idempotencyRecords.keyHash, keyHash),
        ),
      )
      .returning();
    return record ? success(record) : conflict('not_found');
  }
}
