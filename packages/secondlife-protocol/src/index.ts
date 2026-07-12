import { z } from 'zod';

export const PROTOCOL_VERSION = '2026-01' as const;

export enum DeviceType {
  AvatarLink = 'avatar_link',
  DeliveryNode = 'delivery_node',
  Vendor = 'vendor',
}

export const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION);
export const DeviceTypeSchema = z.enum(DeviceType);

export const RequestEnvelopeSchema = z.object({
  deviceId: z.uuid(),
  deviceType: DeviceTypeSchema,
  messageId: z.uuid(),
  payload: z.record(z.string(), z.unknown()),
  sentAt: z.iso.datetime(),
  version: ProtocolVersionSchema,
});

export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;
