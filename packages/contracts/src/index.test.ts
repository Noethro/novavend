import { describe, expect, it } from 'vitest';
import { ApiErrorResponseSchema, HealthResponseSchema } from './index';

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
