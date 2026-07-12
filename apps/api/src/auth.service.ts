import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { loadApiConfig } from '@novavend/config';
import {
  AuthSessionResponseSchema,
  type AuthSessionResponse,
} from '@novavend/contracts';
import {
  AuthenticationRepository,
  normalizeEmail,
  type User,
} from '@novavend/database';
import type { FastifyRequest } from 'fastify';
import type Redis from 'ioredis';
import { AuthRateLimiter } from './auth-rate-limit';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  readCookie,
  verifyPassword,
} from './auth-security';
import {
  DATABASE_RESOURCE,
  REDIS_RESOURCE,
  type DatabaseResource,
} from './infrastructure.service';

const config = loadApiConfig(process.env);

export interface AuthenticatedRequest {
  tokenHash: string;
  user: User;
}

@Injectable()
export class AuthService {
  private readonly repository: AuthenticationRepository;
  private readonly limiter: AuthRateLimiter;

  constructor(
    @Inject(DATABASE_RESOURCE) database: DatabaseResource,
    @Inject(REDIS_RESOURCE) redis: Redis,
  ) {
    this.repository = new AuthenticationRepository(database.database);
    this.limiter = new AuthRateLimiter(
      redis,
      config.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    );
  }

  async register(input: {
    correlationId?: string;
    displayName: string;
    email: string;
    ip: string;
    password: string;
  }) {
    await this.enforce(
      this.limiter.registrationKey(input.ip),
      config.AUTH_REGISTER_IP_LIMIT,
    );
    const passwordHash = await hashPassword(input.password);
    const result = await this.repository.register({ ...input, passwordHash });
    if (!result.ok) {
      throw new ConflictException({
        error: 'AUTH_EMAIL_CONFLICT',
        message: 'An account with this email cannot be created',
      });
    }
    const token = await this.issueSession(result.user.id);
    return { response: await this.projectSession(result.user), token };
  }

  async login(input: {
    correlationId?: string;
    email: string;
    ip: string;
    password: string;
  }) {
    const emailNormalized = normalizeEmail(input.email);
    await Promise.all([
      this.enforce(
        this.limiter.loginIpKey(input.ip),
        config.AUTH_LOGIN_IP_LIMIT,
      ),
      this.enforce(
        this.limiter.loginIdentityKey(input.ip, emailNormalized),
        config.AUTH_LOGIN_EMAIL_IP_LIMIT,
      ),
    ]);
    const credential = await this.repository.findCredential(input.email);
    const valid = credential
      ? await verifyPassword(credential.passwordHash, input.password)
      : await hashPassword(input.password).then(() => false);
    if (!credential || !valid) {
      throw new UnauthorizedException({
        error: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const token = await this.issueSession(credential.user.id);
    await this.repository.appendAuthAudit({
      action: 'auth.login_succeeded',
      correlationId: input.correlationId,
      userId: credential.user.id,
    });
    return { response: await this.projectSession(credential.user), token };
  }

  async authenticate(request: FastifyRequest): Promise<AuthenticatedRequest> {
    const token = readCookie(
      request.headers.cookie,
      config.SESSION_COOKIE_NAME,
    );
    if (!token) throw new UnauthorizedException('Authentication required');
    const tokenHash = hashSessionToken(decodeURIComponent(token));
    const resolved = await this.repository.resolveSession(tokenHash);
    if (!resolved) throw new UnauthorizedException('Authentication required');
    if (Date.now() - resolved.session.lastSeenAt.getTime() > 15 * 60 * 1000) {
      await this.repository.touchSession(resolved.session.id);
    }
    return { tokenHash, user: resolved.user };
  }

  async currentSession(
    identity: AuthenticatedRequest,
  ): Promise<AuthSessionResponse> {
    return this.projectSession(identity.user);
  }

  async logout(request: FastifyRequest): Promise<void> {
    const token = readCookie(
      request.headers.cookie,
      config.SESSION_COOKIE_NAME,
    );
    if (!token) return;
    const revoked = await this.repository.revokeSession(
      hashSessionToken(decodeURIComponent(token)),
    );
    if (revoked) {
      await this.repository.appendAuthAudit({
        action: 'auth.logout',
        correlationId: request.id,
        userId: revoked.userId,
      });
    }
  }

  async onboard(
    identity: AuthenticatedRequest,
    correlationId: string,
    input: { name: string; slug?: string },
  ) {
    const result = await this.repository.onboardFirstWorkspace({
      correlationId,
      name: input.name,
      slug: input.slug ?? input.name,
      userId: identity.user.id,
    });
    if (!result.ok) {
      const status = result.reason === 'already_onboarded' ? 409 : 400;
      throw new HttpException(
        {
          error: `ONBOARDING_${result.reason.toUpperCase()}`,
          message: 'Workspace onboarding could not be completed',
        },
        status,
      );
    }
    return {
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        role: 'owner' as const,
        slug: result.workspace.slug,
      },
    };
  }

  private async issueSession(userId: string): Promise<string> {
    const token = generateSessionToken();
    await this.repository.createSession({
      expiresAt: new Date(Date.now() + config.SESSION_TTL_SECONDS * 1000),
      tokenHash: hashSessionToken(token),
      userId,
    });
    return token;
  }

  private async projectSession(user: User): Promise<AuthSessionResponse> {
    const memberships = await this.repository.listMemberships(user.id);
    return AuthSessionResponseSchema.parse({
      needsOnboarding: memberships.length === 0,
      user: {
        displayName: user.displayName,
        id: user.id,
        status: user.status,
      },
      workspaces: memberships.map((membership) => ({
        id: membership.workspaceId,
        name: membership.workspaceName,
        role: membership.role,
        slug: membership.workspaceSlug,
      })),
    });
  }

  private async enforce(key: string, limit: number): Promise<void> {
    try {
      const decision = await this.limiter.consume(key, limit);
      if (!decision.allowed) {
        throw new HttpException(
          {
            error: 'AUTH_RATE_LIMITED',
            message: 'Too many authentication attempts',
            retryAfter: decision.retryAfter,
          },
          429,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({
        error: 'AUTH_RATE_LIMIT_UNAVAILABLE',
        message: 'Authentication is temporarily unavailable',
      });
    }
  }
}
