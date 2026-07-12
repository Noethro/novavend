import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { loadApiConfig } from '@novavend/config';
import { AvatarPairingRepository } from '@novavend/database';
import type Redis from 'ioredis';
import { AuthRateLimiter } from './auth-rate-limit';
import {
  generatePairingToken,
  hashPairingToken,
  pairingRateFingerprint,
} from './avatar-pairing-security';
import {
  DATABASE_RESOURCE,
  REDIS_RESOURCE,
  type DatabaseResource,
} from './infrastructure.service';

const config = loadApiConfig(process.env);

@Injectable()
export class AvatarPairingService {
  private readonly repository: AvatarPairingRepository;
  private readonly limiter: AuthRateLimiter;

  constructor(
    @Inject(DATABASE_RESOURCE) database: DatabaseResource,
    @Inject(REDIS_RESOURCE) redis: Redis,
  ) {
    this.repository = new AvatarPairingRepository(database.database);
    this.limiter = new AuthRateLimiter(
      redis,
      config.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    );
  }

  async create(workspaceId: string, userId: string, correlationId: string) {
    await this.enforce(
      `novavend:pairing:create:${pairingRateFingerprint(workspaceId)}:${pairingRateFingerprint(userId)}`,
      config.AVATAR_PAIRING_CREATE_LIMIT,
    );
    const pairingToken = generatePairingToken();
    const expiresAt = new Date(
      Date.now() + config.AVATAR_PAIRING_TTL_SECONDS * 1000,
    );
    const result = await this.repository.create({
      correlationId,
      createdByUserId: userId,
      expiresAt,
      maxPending: config.AVATAR_PAIRING_MAX_PENDING,
      tokenHash: hashPairingToken(pairingToken),
      workspaceId,
    });
    if (!result.ok)
      throw new ConflictException({
        error: 'PAIRING_PENDING_LIMIT',
        message: 'Too many pending pairing challenges',
      });
    return {
      challengeId: result.challenge.id,
      expiresAt: expiresAt.toISOString(),
      pairingToken,
      status: 'pending' as const,
    };
  }

  async status(workspaceId: string, challengeId: string) {
    const row = await this.repository.find(workspaceId, challengeId);
    if (!row)
      throw new NotFoundException({
        error: 'PAIRING_NOT_FOUND',
        message: 'Pairing challenge was not found',
      });
    return {
      avatar: row.avatar
        ? {
            avatarUuid: row.avatar.avatarUuid,
            displayName: row.avatar.displayName,
            id: row.avatar.id,
            legacyName: row.avatar.legacyName,
            linkedAt:
              row.challenge.claimedAt?.toISOString() ??
              row.avatar.createdAt.toISOString(),
          }
        : undefined,
      challengeId: row.challenge.id,
      expiresAt: row.challenge.expiresAt.toISOString(),
      status: row.challenge.status,
    };
  }

  cancel(
    workspaceId: string,
    challengeId: string,
    userId: string,
    correlationId: string,
  ) {
    return this.repository.cancel(
      workspaceId,
      challengeId,
      userId,
      correlationId,
    );
  }

  list(workspaceId: string) {
    return this.repository.listAvatars(workspaceId).then((avatars) => ({
      avatars: avatars.map((avatar) => ({
        ...avatar,
        linkedAt: avatar.linkedAt.toISOString(),
      })),
    }));
  }

  async revoke(
    workspaceId: string,
    avatarId: string,
    userId: string,
    correlationId: string,
  ) {
    const result = await this.repository.revoke(
      workspaceId,
      avatarId,
      userId,
      correlationId,
    );
    if (!result.ok)
      throw new NotFoundException({
        error: 'AVATAR_LINK_NOT_FOUND',
        message: 'Avatar link was not found',
      });
  }

  async claim(input: {
    avatarUuid: string;
    displayName?: string;
    ip: string;
    messageId: string;
    pairingToken: string;
  }) {
    const tokenHash = hashPairingToken(input.pairingToken);
    await Promise.all([
      this.enforce(
        `novavend:pairing:claim:ip:${pairingRateFingerprint(input.ip)}`,
        config.AVATAR_PAIRING_CLAIM_IP_LIMIT,
      ),
      this.enforce(
        `novavend:pairing:claim:token:${pairingRateFingerprint(tokenHash)}`,
        config.AVATAR_PAIRING_CLAIM_TOKEN_LIMIT,
      ),
    ]);
    const result = await this.repository.claim({
      avatarUuid: input.avatarUuid,
      displayName: input.displayName,
      messageId: input.messageId,
      tokenHash,
    });
    if (!result.ok) {
      const status =
        result.reason === 'invalid'
          ? 404
          : result.reason === 'consumed'
            ? 409
            : 410;
      throw new HttpException(
        {
          error: `PAIRING_${result.reason.toUpperCase()}`,
          message: 'Pairing could not be completed',
        },
        status,
      );
    }
    return { code: result.outcome.toUpperCase(), ok: true as const };
  }

  private async enforce(key: string, limit: number) {
    try {
      const decision = await this.limiter.consume(key, limit);
      if (!decision.allowed)
        throw new HttpException(
          {
            error: 'PAIRING_RATE_LIMITED',
            message: 'Too many pairing attempts',
            retryAfter: decision.retryAfter,
          },
          429,
        );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({
        error: 'PAIRING_RATE_LIMIT_UNAVAILABLE',
        message: 'Pairing is temporarily unavailable',
      });
    }
  }
}
