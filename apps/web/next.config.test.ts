import { describe, expect, it } from 'vitest';
import { createNextConfig } from './next.config';

describe('Next.js deployment configuration', () => {
  it('keeps normal builds server-capable', () => {
    const config = createNextConfig({});
    expect(config.output).toBe('standalone');
    expect(config.basePath).toBeUndefined();
    expect(config.assetPrefix).toBeUndefined();
    expect(config.trailingSlash).toBeUndefined();
    expect(config.images).toBeUndefined();
  });

  it('enables a repository-scoped static export for GitHub Pages', () => {
    expect(createNextConfig({ GITHUB_PAGES: 'true' })).toMatchObject({
      assetPrefix: '/novavend',
      basePath: '/novavend',
      images: { unoptimized: true },
      output: 'export',
      trailingSlash: true,
    });
  });

  it('does not enable Pages mode for other values', () => {
    expect(createNextConfig({ GITHUB_PAGES: 'false' }).output).toBe(
      'standalone',
    );
  });
});
