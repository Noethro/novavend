import { describe, expect, it } from 'vitest';
import {
  compareIdempotencyRequestHashes,
  hashIdempotencyKey,
  normalizeEmail,
  normalizeWorkspaceSlug,
  prepareWorkspaceSlug,
} from './domain';

describe('normalizeEmail', () => {
  it('trims and lowercases email addresses', () => {
    expect(normalizeEmail(' Merchant@Example.COM ')).toBe(
      'merchant@example.com',
    );
  });
});

describe('workspace slug helpers', () => {
  it('normalizes supported workspace names', () => {
    expect(normalizeWorkspaceSlug(' Nova Vend__Store ')).toBe(
      'nova-vend-store',
    );
    expect(prepareWorkspaceSlug(' Nova Vend__Store ')).toEqual({
      ok: true,
      value: 'nova-vend-store',
    });
  });

  it.each(['-', '💥', 'a', '---'])('rejects invalid slug %s', (slug) => {
    expect(prepareWorkspaceSlug(slug)).toEqual({
      conflict: 'invalid_slug',
      ok: false,
    });
  });
});

describe('typed domain results', () => {
  it('reports matching requests without throwing', () => {
    expect(compareIdempotencyRequestHashes('same', 'same')).toEqual({
      ok: true,
      value: 'duplicate',
    });
  });

  it('reports conflicting reuse without throwing', () => {
    expect(compareIdempotencyRequestHashes('first', 'second')).toEqual({
      conflict: 'conflicting_request',
      ok: false,
    });
  });

  it('hashes raw idempotency keys before persistence', () => {
    const raw = 'never-store-this-key';
    const hashed = hashIdempotencyKey(raw);
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain(raw);
  });
});
