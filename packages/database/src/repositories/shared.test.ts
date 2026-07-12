import { describe, expect, it } from 'vitest';
import { isPostgresErrorCode } from './shared';

describe('isPostgresErrorCode', () => {
  it('recognizes a direct postgres error', () => {
    expect(isPostgresErrorCode({ code: '23505' }, '23505')).toBe(true);
  });

  it('recognizes a postgres error wrapped by Drizzle', () => {
    expect(
      isPostgresErrorCode(
        { cause: { code: '23505' }, message: 'Failed query' },
        '23505',
      ),
    ).toBe(true);
  });
});
