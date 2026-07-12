import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { loadApiConfig } from '@novavend/config';
import {
  assertSimulatorDevice,
  parseAvatarPairingClaim,
  parseSimulatorHeaders,
} from '@novavend/secondlife-protocol';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthIdentity, AuthenticationGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.service';
import { isAllowedMutationOrigin } from './auth-security';
import { AvatarPairingService } from './avatar-pairing.service';
import { WorkspaceAccessService } from './workspace-access.service';

const config = loadApiConfig(process.env);
const uuid = (value: string) => {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success)
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Invalid identifier',
    });
  return parsed.data;
};
const assertOrigin = (request: FastifyRequest) => {
  if (
    !isAllowedMutationOrigin(
      request.headers.origin,
      config.API_ALLOWED_WEB_ORIGIN,
    )
  )
    throw new HttpException(
      {
        error: 'AUTH_ORIGIN_REJECTED',
        message: 'Request origin is not allowed',
      },
      403,
    );
};

@Controller('workspaces/:workspaceId')
@UseGuards(AuthenticationGuard)
export class WorkspaceAvatarController {
  constructor(
    private readonly pairing: AvatarPairingService,
    private readonly access: WorkspaceAccessService,
  ) {}

  @Post('avatar-pairings')
  async create(
    @Param('workspaceId') workspaceIdRaw: string,
    @Req() request: FastifyRequest,
    @AuthIdentity() identity: AuthenticatedRequest,
  ) {
    assertOrigin(request);
    const workspaceId = uuid(workspaceIdRaw);
    await this.access.requireManager(identity.user.id, workspaceId);
    return this.pairing.create(workspaceId, identity.user.id, request.id);
  }

  @Get('avatar-pairings/:challengeId')
  async status(
    @Param('workspaceId') workspaceIdRaw: string,
    @Param('challengeId') challengeIdRaw: string,
    @AuthIdentity() identity: AuthenticatedRequest,
  ) {
    const workspaceId = uuid(workspaceIdRaw);
    await this.access.requireMember(identity.user.id, workspaceId);
    return this.pairing.status(workspaceId, uuid(challengeIdRaw));
  }

  @Delete('avatar-pairings/:challengeId')
  @HttpCode(204)
  async cancel(
    @Param('workspaceId') workspaceIdRaw: string,
    @Param('challengeId') challengeIdRaw: string,
    @Req() request: FastifyRequest,
    @AuthIdentity() identity: AuthenticatedRequest,
  ) {
    assertOrigin(request);
    const workspaceId = uuid(workspaceIdRaw);
    await this.access.requireManager(identity.user.id, workspaceId);
    await this.pairing.cancel(
      workspaceId,
      uuid(challengeIdRaw),
      identity.user.id,
      request.id,
    );
  }

  @Get('avatars')
  async list(
    @Param('workspaceId') workspaceIdRaw: string,
    @AuthIdentity() identity: AuthenticatedRequest,
  ) {
    const workspaceId = uuid(workspaceIdRaw);
    await this.access.requireMember(identity.user.id, workspaceId);
    return this.pairing.list(workspaceId);
  }

  @Delete('avatars/:avatarAccountId')
  @HttpCode(204)
  async revoke(
    @Param('workspaceId') workspaceIdRaw: string,
    @Param('avatarAccountId') avatarIdRaw: string,
    @Req() request: FastifyRequest,
    @AuthIdentity() identity: AuthenticatedRequest,
  ) {
    assertOrigin(request);
    const workspaceId = uuid(workspaceIdRaw);
    await this.access.requireManager(identity.user.id, workspaceId);
    await this.pairing.revoke(
      workspaceId,
      uuid(avatarIdRaw),
      identity.user.id,
      request.id,
    );
  }
}

@Controller('secondlife/v1/avatar-pairings')
export class SecondLifeAvatarPairingController {
  constructor(private readonly pairing: AvatarPairingService) {}

  @Post('claim')
  async claim(@Req() request: FastifyRequest) {
    if (
      !String(request.headers['content-type'] ?? '')
        .toLowerCase()
        .startsWith('application/json')
    )
      throw new BadRequestException({
        error: 'PROTOCOL_JSON_REQUIRED',
        message: 'JSON is required',
      });
    if (Number(request.headers['content-length'] ?? 0) > 8192)
      throw new BadRequestException({
        error: 'PROTOCOL_BODY_TOO_LARGE',
        message: 'Request is too large',
      });
    try {
      const envelope = parseAvatarPairingClaim(
        request.body,
        new Date(),
        config.AVATAR_PAIRING_CLOCK_SKEW_SECONDS,
      );
      const identity = parseSimulatorHeaders(request.headers);
      assertSimulatorDevice(identity, envelope);
      return this.pairing.claim({
        avatarUuid: identity.avatarUuid,
        displayName: identity.ownerName,
        ip: request.ip,
        messageId: envelope.messageId,
        pairingToken: envelope.payload.pairingToken,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException({
        error:
          error instanceof Error && error.message === 'PROTOCOL_DEVICE_MISMATCH'
            ? 'PROTOCOL_DEVICE_MISMATCH'
            : 'PROTOCOL_INVALID',
        message: 'Invalid Second Life pairing request',
      });
    }
  }
}
