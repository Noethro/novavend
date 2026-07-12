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

export const AvatarPairingClaimPayloadSchema = z
  .object({ pairingToken: z.string().regex(/^[A-Za-z0-9_-]{32}$/) })
  .strict();

export const AvatarPairingClaimEnvelopeSchema = z
  .object({
    deviceId: z.uuid(),
    deviceType: z.literal(DeviceType.AvatarLink),
    messageId: z.uuid(),
    payload: AvatarPairingClaimPayloadSchema,
    sentAt: z.iso.datetime(),
    version: ProtocolVersionSchema,
  })
  .strict();

export type AvatarPairingClaimEnvelope = z.infer<
  typeof AvatarPairingClaimEnvelopeSchema
>;

export const parseAvatarPairingClaim = (
  value: unknown,
  now = new Date(),
  maxClockSkewSeconds = 300,
): AvatarPairingClaimEnvelope => {
  const envelope = AvatarPairingClaimEnvelopeSchema.parse(value);
  if (
    Math.abs(now.getTime() - new Date(envelope.sentAt).getTime()) >
    maxClockSkewSeconds * 1000
  )
    throw new Error('PROTOCOL_CLOCK_SKEW');
  return envelope;
};

export const SECOND_LIFE_HEADERS = {
  objectKey: 'x-secondlife-object-key',
  objectName: 'x-secondlife-object-name',
  ownerKey: 'x-secondlife-owner-key',
  ownerName: 'x-secondlife-owner-name',
  region: 'x-secondlife-region',
  shard: 'x-secondlife-shard',
} as const;

export interface SimulatorIdentity {
  avatarUuid: string;
  objectName?: string;
  objectUuid: string;
  ownerName?: string;
  region?: string;
  shard?: string;
}

const optionalHeader = (value: string | string[] | undefined) => {
  const text = Array.isArray(value) ? value[0] : value;
  return text?.trim().slice(0, 128) || undefined;
};

export const parseSimulatorHeaders = (
  headers: Record<string, string | string[] | undefined>,
): SimulatorIdentity => {
  const avatarUuid = z
    .uuid()
    .parse(optionalHeader(headers[SECOND_LIFE_HEADERS.ownerKey]));
  const objectUuid = z
    .uuid()
    .parse(optionalHeader(headers[SECOND_LIFE_HEADERS.objectKey]));
  return {
    avatarUuid,
    objectName: optionalHeader(headers[SECOND_LIFE_HEADERS.objectName]),
    objectUuid,
    ownerName: optionalHeader(headers[SECOND_LIFE_HEADERS.ownerName]),
    region: optionalHeader(headers[SECOND_LIFE_HEADERS.region]),
    shard: optionalHeader(headers[SECOND_LIFE_HEADERS.shard]),
  };
};

export const assertSimulatorDevice = (
  identity: SimulatorIdentity,
  envelope: AvatarPairingClaimEnvelope,
): void => {
  if (identity.objectUuid !== envelope.deviceId)
    throw new Error('PROTOCOL_DEVICE_MISMATCH');
};

export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;
