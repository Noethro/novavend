import { z } from 'zod';

const LogLevelSchema = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
  .default('info');
const NodeEnvironmentSchema = z
  .enum(['development', 'test', 'production'])
  .default('development');
const PortSchema = z.coerce.number().int().min(1).max(65_535);
const PostgresUrlSchema = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith('postgresql://') || value.startsWith('postgres://'),
    {
      message: 'Must be a PostgreSQL URL',
    },
  );
const RedisUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
    {
      message: 'Must be a Redis URL',
    },
  );
const BooleanEnvironmentSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const WebConfigSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  WEB_PORT: PortSchema.default(3000),
});

export const DatabaseConfigSchema = z.object({
  DATABASE_URL: PostgresUrlSchema,
});
export const RedisConfigSchema = z.object({ REDIS_URL: RedisUrlSchema });

export const ApiConfigSchema = z
  .object({
    API_PORT: PortSchema.default(3001),
    LOG_LEVEL: LogLevelSchema,
    NODE_ENV: NodeEnvironmentSchema,
  })
  .and(DatabaseConfigSchema)
  .and(RedisConfigSchema);

export const WorkerConfigSchema = z
  .object({
    ENABLE_SAMPLE_WORKER: BooleanEnvironmentSchema,
    LOG_LEVEL: LogLevelSchema,
    NODE_ENV: NodeEnvironmentSchema,
  })
  .and(DatabaseConfigSchema)
  .and(RedisConfigSchema);

export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type WebConfig = z.infer<typeof WebConfigSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;

type Environment = Record<string, string | undefined>;

export const loadWebConfig = (environment: Environment): WebConfig =>
  WebConfigSchema.parse(environment);
export const loadApiConfig = (environment: Environment): ApiConfig =>
  ApiConfigSchema.parse(environment);
export const loadWorkerConfig = (environment: Environment): WorkerConfig =>
  WorkerConfigSchema.parse(environment);
export const loadDatabaseConfig = (environment: Environment): DatabaseConfig =>
  DatabaseConfigSchema.parse(environment);
export const loadRedisConfig = (environment: Environment): RedisConfig =>
  RedisConfigSchema.parse(environment);
