import { and, eq, isNull } from 'drizzle-orm';
import type { NovaVendDatabase } from '../index';
import {
  conflict,
  normalizeEmail,
  success,
  type DomainResult,
} from '../domain';
import { users, type User } from '../schema';
import { isPostgresErrorCode, requireRow } from './shared';

export interface CreateUserInput {
  displayName?: string | null;
  email: string;
  status?: 'pending' | 'active' | 'suspended';
}

export class UserRepository {
  constructor(private readonly database: NovaVendDatabase) {}

  async createUser(
    input: CreateUserInput,
  ): Promise<DomainResult<User, 'duplicate_email'>> {
    try {
      const [created] = await this.database
        .insert(users)
        .values({
          displayName: input.displayName,
          email: input.email,
          emailNormalized: normalizeEmail(input.email),
          status: input.status ?? 'pending',
        })
        .returning();
      return success(requireRow(created, 'create user'));
    } catch (error) {
      if (isPostgresErrorCode(error, '23505'))
        return conflict('duplicate_email');
      throw error;
    }
  }

  async findActiveUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(
        and(
          eq(users.emailNormalized, normalizeEmail(email)),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return user;
  }

  async softDeleteUser(
    userId: string,
  ): Promise<DomainResult<User, 'not_found'>> {
    const now = new Date();
    const [deleted] = await this.database
      .update(users)
      .set({ deletedAt: now, status: 'deleted', updatedAt: now })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    return deleted ? success(deleted) : conflict('not_found');
  }
}
