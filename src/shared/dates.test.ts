import { describe, expect, it } from 'vitest';
import { formatDate, isoToLocalDate, isoYear, parseDisplayDate, parseIsoDate, toIsoDate, todayIso } from './dates';

describe('dates', () => {
  it('formats dd.mm.yyyy without timezone shifts', () => {
    expect(formatDate('2025-03-07')).toBe('07.03.2025');
    expect(formatDate('2025-01-01')).toBe('01.01.2025');
    expect(formatDate('2025-12-31')).toBe('31.12.2025');
    expect(formatDate('2025-03-07T00:00:00')).toBe('07.03.2025');
  });
  it('handles empty and invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('nope')).toBe('nope');
    expect(formatDate('2025-02-30')).toBe('2025-02-30');
  });
  it('validates calendar dates', () => {
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseIsoDate('2025-02-29')).toBeNull();
    expect(parseIsoDate('2025-13-01')).toBeNull();
  });
  it('parses display dates', () => {
    expect(parseDisplayDate('7.3.2025')).toBe('2025-03-07');
    expect(parseDisplayDate('07. 03. 2025')).toBe('2025-03-07');
    expect(parseDisplayDate('31.02.2025')).toBeNull();
    expect(parseDisplayDate('2025-03-07')).toBeNull();
  });
  it('uses local time for Date conversions', () => {
    const d = new Date(2025, 2, 7, 23, 59);
    expect(toIsoDate(d)).toBe('2025-03-07');
    expect(todayIso(d)).toBe('2025-03-07');
    const back = isoToLocalDate('2025-03-07')!;
    expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([2025, 2, 7]);
    expect(isoYear('2025-03-07')).toBe(2025);
  });
});
