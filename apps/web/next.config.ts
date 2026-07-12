import type { NextConfig } from 'next';

type BuildEnvironment = Record<string, string | undefined>;

export const createNextConfig = (environment: BuildEnvironment): NextConfig => {
  const isGitHubPages = environment.GITHUB_PAGES === 'true';
  return {
    allowedDevOrigins: ['127.0.0.1'],
    transpilePackages: ['@novavend/ui'],
    ...(isGitHubPages
      ? {
          assetPrefix: '/novavend',
          basePath: '/novavend',
          images: { unoptimized: true },
          output: 'export' as const,
          trailingSlash: true,
        }
      : { output: 'standalone' as const }),
  };
};

export default createNextConfig(process.env);
