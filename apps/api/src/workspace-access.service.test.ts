import { describe, expect, it } from 'vitest';
import { canManageAvatars } from './workspace-access.service';

describe('workspace avatar authorization', () => {
  it.each([
    ['owner', true],
    ['manager', true],
    ['support', false],
    ['viewer', false],
  ] as const)('%s management permission is %s', (role, expected) => {
    expect(canManageAvatars(role)).toBe(expected);
  });
});
