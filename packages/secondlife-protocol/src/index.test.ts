import { describe, expect, it } from 'vitest';
import { ProtocolEnvelopeSchema } from './index';

describe('ProtocolEnvelopeSchema', () => {
  it('accepts the independently defined bootstrap envelope', () => {
    expect(
      ProtocolEnvelopeSchema.parse({
        messageId: '8cfa5ad3-4d4d-4a22-a4fa-95c77b2147c3',
        sentAt: '2026-07-12T12:00:00.000Z',
        version: '2026-01',
      }),
    ).toBeTruthy();
  });
});
