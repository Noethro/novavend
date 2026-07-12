import { createHash } from 'node:crypto';

export type DomainResult<T, Conflict extends string> =
  { ok: true; value: T } | { conflict: Conflict; ok: false };

export const success = <T>(value: T): DomainResult<T, never> => ({
  ok: true,
  value,
});
export const conflict = <Conflict extends string>(
  code: Conflict,
): DomainResult<never, Conflict> => ({ conflict: code, ok: false });

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export const normalizeWorkspaceSlug = (slug: string): string =>
  slug
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_]+/g, '-')
    .replaceAll(/[^a-z0-9-]/g, '')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');

export const prepareWorkspaceSlug = (
  slug: string,
): DomainResult<string, 'invalid_slug'> => {
  const normalized = normalizeWorkspaceSlug(slug);
  if (
    normalized.length < 2 ||
    normalized.length > 63 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
  ) {
    return conflict('invalid_slug');
  }
  return success(normalized);
};

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const hashIdempotencyKey = (rawKey: string): string => sha256(rawKey);
export const hashRequestPayload = (canonicalPayload: string): string =>
  sha256(canonicalPayload);

export const compareIdempotencyRequestHashes = (
  existingHash: string,
  incomingHash: string,
): DomainResult<'duplicate', 'conflicting_request'> =>
  existingHash === incomingHash
    ? success('duplicate')
    : conflict('conflicting_request');
