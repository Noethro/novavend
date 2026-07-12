import { z } from 'zod';

export const HealthResponseSchema = z.object({
  service: z.string().min(1),
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const DependencyHealthSchema = z.object({
  message: z.string().optional(),
  status: z.enum(['up', 'down']),
});

export const ReadinessResponseSchema = z.object({
  dependencies: z.object({
    postgres: DependencyHealthSchema,
    redis: DependencyHealthSchema,
  }),
  service: z.literal('api'),
  status: z.enum(['ready', 'unhealthy']),
});

export const ApiValidationDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
});

export const ApiErrorResponseSchema = z.object({
  code: z.string().min(1),
  correlationId: z.uuid(),
  details: z.array(ApiValidationDetailSchema).optional(),
  message: z.string().min(1),
  status: z.number().int().min(400).max(599),
  timestamp: z.iso.datetime(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiValidationDetail = z.infer<typeof ApiValidationDetailSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
