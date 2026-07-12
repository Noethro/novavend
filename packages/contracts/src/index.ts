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

export const PasswordSchema = z.string().min(12).max(128);
const EmailSchema = z.string().trim().max(320).pipe(z.email());
export const RegisterRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: EmailSchema,
  password: PasswordSchema,
});
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
export const OnboardingWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(80).optional(),
});
export const SafeUserSchema = z.object({
  displayName: z.string().nullable(),
  id: z.uuid(),
  status: z.enum(['pending', 'active']),
});
export const WorkspaceSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(['owner', 'manager', 'support', 'viewer']),
  slug: z.string(),
});
export const AuthSessionResponseSchema = z.object({
  needsOnboarding: z.boolean(),
  user: SafeUserSchema,
  workspaces: z.array(WorkspaceSummarySchema),
});
export const AuthMutationResponseSchema = AuthSessionResponseSchema;
export const OnboardingWorkspaceResponseSchema = z.object({
  workspace: WorkspaceSummarySchema,
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type OnboardingWorkspaceRequest = z.infer<
  typeof OnboardingWorkspaceRequestSchema
>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
