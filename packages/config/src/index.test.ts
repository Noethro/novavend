import { describe, expect, it } from 'vitest';
import { loadApiConfig } from './index';

describe('loadApiConfig', () => {
  it('coerces the port and applies defaults', () => {
    const config = loadApiConfig({
      API_PORT: '4000',
      DATABASE_URL: 'postgresql://localhost/novavend',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(config.API_PORT).toBe(4000);
    expect(config.LOG_LEVEL).toBe('info');
  });
});
