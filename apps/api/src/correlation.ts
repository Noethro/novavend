import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
const CorrelationIdSchema = z.uuid();

export const resolveCorrelationId = (header: unknown): string => {
  const value = Array.isArray(header) ? header[0] : header;
  const result = CorrelationIdSchema.safeParse(value);
  return result.success ? result.data : randomUUID();
};
