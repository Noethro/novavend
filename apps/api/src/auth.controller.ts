import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { loadApiConfig } from '@novavend/config';
import {
  LoginRequestSchema,
  OnboardingWorkspaceRequestSchema,
  RegisterRequestSchema,
} from '@novavend/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodType } from 'zod';
import { AuthService } from './auth.service';
import {
  expiredSessionCookie,
  isAllowedMutationOrigin,
  sessionCookie,
} from './auth-security';

const config = loadApiConfig(process.env);
const cookieConfig = {
  cookieName: config.SESSION_COOKIE_NAME,
  maxAgeSeconds: config.SESSION_TTL_SECONDS,
  secure: config.SESSION_COOKIE_SECURE,
};

const parse = <T>(schema: ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: result.error.issues.map((issue) => issue.message),
    });
  }
  return result.data;
};

const assertOrigin = (request: FastifyRequest): void => {
  const origin = request.headers.origin;
  if (!isAllowedMutationOrigin(origin, config.API_ALLOWED_WEB_ORIGIN)) {
    throw new HttpException(
      {
        error: 'AUTH_ORIGIN_REJECTED',
        message: 'Request origin is not allowed',
      },
      403,
    );
  }
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    assertOrigin(request);
    const input = parse(RegisterRequestSchema, body);
    const result = await this.auth.register({
      ...input,
      correlationId: request.id,
      ip: request.ip,
    });
    reply.header('set-cookie', sessionCookie(result.token, cookieConfig));
    return result.response;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    assertOrigin(request);
    const result = await this.auth.login({
      ...parse(LoginRequestSchema, body),
      correlationId: request.id,
      ip: request.ip,
    });
    reply.header('set-cookie', sessionCookie(result.token, cookieConfig));
    return result.response;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    assertOrigin(request);
    await this.auth.logout(request);
    reply.header('set-cookie', expiredSessionCookie(cookieConfig));
  }

  @Get('session')
  session(@Req() request: FastifyRequest) {
    return this.auth.currentSession(request);
  }
}

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly auth: AuthService) {}

  @Post('workspace')
  async workspace(@Body() body: unknown, @Req() request: FastifyRequest) {
    assertOrigin(request);
    return this.auth.onboard(
      request,
      parse(OnboardingWorkspaceRequestSchema, body),
    );
  }
}
