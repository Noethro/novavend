import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDecimal,
  formatInteger,
  formatLindenDollars,
  formatPercentage,
  formatTime,
} from './formatters';

describe('locale-aware formatters', () => {
  const instant = new Date('2026-07-12T13:45:00.000Z');

  it('formats dates and times deterministically in UTC', () => {
    expect(formatDate(instant, 'en')).toBe('Jul 12, 2026');
    expect(formatTime(instant, 'en')).toMatch(/1:45|01:45/);
  });

  it('formats integers and decimals using locale separators', () => {
    expect(formatInteger(12345, 'en')).toBe('12,345');
    expect(formatInteger(12345, 'de')).toBe('12.345');
    expect(formatDecimal(1234.5, 'de')).toBe('1.234,50');
  });

  it('formats percentages', () => {
    expect(formatPercentage(0.25, 'en')).toBe('25%');
    expect(formatPercentage(0.25, 'tr')).toContain('%25');
  });

  it('keeps Second Life currency labeled as L$ without conversion', () => {
    expect(formatLindenDollars(1250, 'en')).toBe('L$ 1,250');
    expect(formatLindenDollars(1250, 'de')).toBe('L$ 1.250');
  });
});
