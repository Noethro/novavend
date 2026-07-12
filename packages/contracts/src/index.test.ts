import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './index';

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
