import { describe, expect, test } from 'vitest';
import { formatSingaporeDate, getSingaporeNow, toSingaporeDate } from '@/lib/timezone';

describe('timezone utilities', () => {
  test('getSingaporeNow returns a valid date near current time', () => {
    const now = getSingaporeNow();
    expect(Number.isNaN(now.getTime())).toBe(false);

    const diffMs = Math.abs(Date.now() - now.getTime());
    expect(diffMs).toBeLessThan(5_000);
  });

  test('toSingaporeDate accepts string and keeps the same instant', () => {
    const input = '2026-03-12T08:30:00+08:00';
    const converted = toSingaporeDate(input);

    expect(converted.toISOString()).toBe('2026-03-12T00:30:00.000Z');
  });

  test('toSingaporeDate accepts Date objects', () => {
    const input = new Date('2026-01-01T00:00:00.000Z');
    const converted = toSingaporeDate(input);
    expect(converted.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  test('formatSingaporeDate returns user friendly string', () => {
    const output = formatSingaporeDate('2026-03-12T08:30:00+08:00');
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain('2026');
  });
});
