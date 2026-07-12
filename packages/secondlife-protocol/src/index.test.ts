import { describe, expect, it } from 'vitest';
import {
  assertSimulatorDevice,
  AvatarPairingClaimEnvelopeSchema,
  DeviceType,
  DeviceTypeSchema,
  PROTOCOL_VERSION,
  RequestEnvelopeSchema,
  parseAvatarPairingClaim,
  parseSimulatorHeaders,
} from './index';

const envelope = {
  deviceId: '6eb8d76d-b723-4f9d-9ca6-97684a9a14ab',
  deviceType: DeviceType.Vendor,
  messageId: '8cfa5ad3-4d4d-4a22-a4fa-95c77b2147c3',
  payload: { event: 'heartbeat' },
  sentAt: '2026-07-12T12:00:00.000Z',
  version: PROTOCOL_VERSION,
};

describe('request envelope', () => {
  it('accepts a valid clean-room request envelope', () => {
    expect(RequestEnvelopeSchema.parse(envelope)).toEqual(envelope);
  });

  it.each(['bad-id', 'not-a-date', '2025-01'])(
    'rejects invalid envelope data: %s',
    (value) => {
      expect(
        RequestEnvelopeSchema.safeParse({
          ...envelope,
          deviceId: value,
          sentAt: value,
          version: value,
        }).success,
      ).toBe(false);
    },
  );
});

describe('device types', () => {
  it.each(['vendor', 'delivery_node', 'avatar_link'])(
    'accepts %s',
    (deviceType) => {
      expect(DeviceTypeSchema.parse(deviceType)).toBe(deviceType);
    },
  );

  it('rejects unknown device types', () => {
    expect(DeviceTypeSchema.safeParse('rental_box').success).toBe(false);
  });
});

const claim = {
  ...envelope,
  deviceType: DeviceType.AvatarLink,
  payload: { pairingToken: 'safe_base64url_token_value' },
};

describe('avatar pairing protocol', () => {
  it('accepts a strict, timely claim and matching simulator identity', () => {
    const parsed = parseAvatarPairingClaim(
      claim,
      new Date('2026-07-12T12:01:00.000Z'),
    );
    const identity = parseSimulatorHeaders({
      'x-secondlife-object-key': claim.deviceId,
      'x-secondlife-owner-key': '9e1635f4-e428-44f0-8405-93a021740bda',
      'x-secondlife-owner-name': 'Nova Resident',
    });
    expect(() => assertSimulatorDevice(identity, parsed)).not.toThrow();
    expect(identity.avatarUuid).toBe('9e1635f4-e428-44f0-8405-93a021740bda');
  });

  it('rejects unknown fields, stale messages, malformed headers, and mismatches', () => {
    expect(
      AvatarPairingClaimEnvelopeSchema.safeParse({ ...claim, extra: true })
        .success,
    ).toBe(false);
    expect(() =>
      parseAvatarPairingClaim(claim, new Date('2026-07-12T13:00:00.000Z')),
    ).toThrow('PROTOCOL_CLOCK_SKEW');
    expect(() => parseSimulatorHeaders({})).toThrow();
    const identity = parseSimulatorHeaders({
      'x-secondlife-object-key': '53fe3c16-43a2-43f7-8f9c-6f9f34ff1826',
      'x-secondlife-owner-key': '9e1635f4-e428-44f0-8405-93a021740bda',
    });
    expect(() => assertSimulatorDevice(identity, claim)).toThrow(
      'PROTOCOL_DEVICE_MISMATCH',
    );
  });
});
