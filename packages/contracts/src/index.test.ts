import { describe, expect, it } from 'vitest';
import {
  AvatarPairingStatusResponseSchema,
  CreateAvatarPairingResponseSchema,
  ApiErrorResponseSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  OnboardingWorkspaceRequestSchema,
  RegisterRequestSchema,
} from './index';

describe('HealthResponseSchema', () => {
  it('accepts a healthy service response', () => {
    expect(
      HealthResponseSchema.parse({ service: 'api', status: 'ok' }),
    ).toEqual({
      service: 'api',
      status: 'ok',
    });
  });
});

describe('authentication contracts', () => {
  it('accepts valid registration, login, and onboarding payloads', () => {
    expect(
      RegisterRequestSchema.safeParse({
        displayName: 'Merchant',
        email: 'merchant@example.com',
        password: 'twelve-chars!',
      }).success,
    ).toBe(true);
    expect(
      LoginRequestSchema.safeParse({
        email: 'merchant@example.com',
        password: 'twelve-chars!',
      }).success,
    ).toBe(true);
    expect(
      OnboardingWorkspaceRequestSchema.safeParse({ name: 'Nova Shop' }).success,
    ).toBe(true);
  });

  it('rejects short passwords and malformed identity data', () => {
    expect(
      RegisterRequestSchema.safeParse({
        displayName: '',
        email: 'bad',
        password: 'short',
      }).success,
    ).toBe(false);
    expect(
      LoginRequestSchema.safeParse({ email: 'bad', password: 'short' }).success,
    ).toBe(false);
  });
});

describe('avatar pairing contracts', () => {
  it('returns the raw token only in the create response', () => {
    expect(
      CreateAvatarPairingResponseSchema.parse({
        challengeId: '6eb8d76d-b723-4f9d-9ca6-97684a9a14ab',
        expiresAt: '2026-07-12T12:10:00.000Z',
        pairingToken: '0123456789abcdefghijklmnopqrstuv',
        status: 'pending',
      }).pairingToken,
    ).toBe('0123456789abcdefghijklmnopqrstuv');
    expect(
      AvatarPairingStatusResponseSchema.parse({
        challengeId: '6eb8d76d-b723-4f9d-9ca6-97684a9a14ab',
        expiresAt: '2026-07-12T12:10:00.000Z',
        status: 'pending',
      }),
    ).not.toHaveProperty('pairingToken');
  });
});

describe('ApiErrorResponseSchema', () => {
  const validError = {
    code: 'VALIDATION_ERROR',
    correlationId: '8cfa5ad3-4d4d-4a22-a4fa-95c77b2147c3',
    details: [{ field: 'name', message: 'name is required' }],
    message: 'Request validation failed',
    status: 400,
    timestamp: '2026-07-12T12:00:00.000Z',
  };

  it('accepts a standard API error', () => {
    expect(ApiErrorResponseSchema.parse(validError)).toEqual(validError);
  });

  it('accepts an error without validation details', () => {
    const error = {
      code: validError.code,
      correlationId: validError.correlationId,
      message: validError.message,
      status: validError.status,
      timestamp: validError.timestamp,
    };
    expect(ApiErrorResponseSchema.parse(error)).toEqual(error);
  });

  it('rejects malformed errors', () => {
    expect(() =>
      ApiErrorResponseSchema.parse({
        ...validError,
        correlationId: 'invalid',
        status: 200,
      }),
    ).toThrow();
  });
});
