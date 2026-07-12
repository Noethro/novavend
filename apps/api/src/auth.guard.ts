import {
  CanActivate,
  ExecutionContext,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService, type AuthenticatedRequest } from './auth.service';

export type AuthenticatedFastifyRequest = FastifyRequest & {
  identity: AuthenticatedRequest;
};

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedFastifyRequest>();
    request.identity = await this.auth.authenticate(request);
    return true;
  }
}

export const AuthIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequest =>
    context.switchToHttp().getRequest<AuthenticatedFastifyRequest>().identity,
);
