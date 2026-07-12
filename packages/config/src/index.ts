import { z } from 'zod';

const BaseConfigSchema = z.object({
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

const ApiConfigSchema = BaseConfigSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url().startsWith('postgresql://'),
  REDIS_URL: z.url().startsWith('redis://'),
});

const WorkerConfigSchema = BaseConfigSchema.extend({
  DATABASE_URL: z.url().startsWith('postgresql://'),
  REDIS_URL: z.url().startsWith('redis://'),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;

export const loadApiConfig = (environment: NodeJS.ProcessEnv): ApiConfig =>
  ApiConfigSchema.parse(environment);

export const loadWorkerConfig = (
  environment: NodeJS.ProcessEnv,
): WorkerConfig => WorkerConfigSchema.parse(environment);
