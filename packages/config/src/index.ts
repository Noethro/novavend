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
const OptionalBooleanEnvironmentSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));
const PositiveIntegerSchema = z.coerce.number().int().positive();

export const WebConfigSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_PREVIEW_MODE: BooleanEnvironmentSchema,
  WEB_PORT: PortSchema.default(3000),
});

export const DatabaseConfigSchema = z.object({
  DATABASE_URL: PostgresUrlSchema,
});
export const RedisConfigSchema = z.object({ REDIS_URL: RedisUrlSchema });

const ApiSecurityConfigSchema = z.object({
  API_ALLOWED_WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  AUTH_LOGIN_EMAIL_IP_LIMIT: PositiveIntegerSchema.default(10),
  AUTH_LOGIN_IP_LIMIT: PositiveIntegerSchema.default(20),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: PositiveIntegerSchema.default(900),
  AUTH_REGISTER_IP_LIMIT: PositiveIntegerSchema.default(5),
  SESSION_COOKIE_NAME: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .default('novavend_session'),
  SESSION_COOKIE_SECURE: OptionalBooleanEnvironmentSchema,
  SESSION_TTL_SECONDS: PositiveIntegerSchema.default(604_800),
});

export const ApiConfigSchema = z
  .object({
    API_PORT: PortSchema.default(3001),
    LOG_LEVEL: LogLevelSchema,
    NODE_ENV: NodeEnvironmentSchema,
  })
  .and(DatabaseConfigSchema)
  .and(RedisConfigSchema)
  .and(ApiSecurityConfigSchema)
  .superRefine((config, context) => {
    if (
      config.NODE_ENV === 'production' &&
      !config.API_ALLOWED_WEB_ORIGIN.startsWith('https://')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Production web origin must use HTTPS',
        path: ['API_ALLOWED_WEB_ORIGIN'],
      });
    }
  })
  .transform((config) => ({
    ...config,
    SESSION_COOKIE_SECURE:
      config.SESSION_COOKIE_SECURE ?? config.NODE_ENV === 'production',
  }));

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
