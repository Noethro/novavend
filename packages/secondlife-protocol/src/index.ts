import { z } from 'zod';

export const ProtocolVersionSchema = z.literal('2026-01');

export const ProtocolEnvelopeSchema = z.object({
  messageId: z.uuid(),
  sentAt: z.iso.datetime(),
  version: ProtocolVersionSchema,
});

export type ProtocolEnvelope = z.infer<typeof ProtocolEnvelopeSchema>;
