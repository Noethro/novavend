import { describe, expect, it } from 'vitest';
import {
  DeviceType,
  DeviceTypeSchema,
  PROTOCOL_VERSION,
  RequestEnvelopeSchema,
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
