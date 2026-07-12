import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
vi.mock('./auth.service', () => ({ AuthService: class AuthService {} }));
import { AuthenticationGuard } from './auth.guard';

describe('AuthenticationGuard', () => {
  it('attaches the resolved identity to the request', async () => {
    const identity = { tokenHash: 'hash', user: { id: 'user-id' } };
    const authenticate = vi.fn().mockResolvedValue(identity);
    const request: Record<string, unknown> = {};
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;

    await expect(
      new AuthenticationGuard({ authenticate } as never).canActivate(context),
    ).resolves.toBe(true);
    expect(request.identity).toBe(identity);
    expect(authenticate).toHaveBeenCalledWith(request);
  });

  it('preserves authentication failures', async () => {
    const error = new UnauthorizedException('Authentication required');
    const context = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as ExecutionContext;
    const guard = new AuthenticationGuard({
      authenticate: vi.fn().mockRejectedValue(error),
    } as never);

    await expect(guard.canActivate(context)).rejects.toBe(error);
  });
});
