import { describe, expect, it } from 'vitest';
import { eurosToCents, formatCents, mulToCents, parseMoney } from './money';

describe('mulToCents (half-up, matches Postgres round(numeric,2))', () => {
  const vectors: [number, number, number][] = [
    [12.5, 0.37, 463], // 4.625 -> 4.63
    [10, 0.37, 370],
    [1, 0.005, 1], // 0.005 -> 0.01
    [0.5, 0.01, 1], // 0.005 -> 0.01
    [3, 0.835, 251], // 2.505 -> 2.51
    [1.15, 100, 11500],
    [0, 0.37, 0],
    [25, 0.37, 925],
    [33.3, 0.37, 1232], // 12.321 -> 12.32
    [100.5, 0.37, 3719], // 37.185 -> 37.19
    [2.675, 1, 268], // classic float trap
    [1.005, 1, 101],
  ];
  it.each(vectors)('%s x %s = %s cents', (a, b, cents) => {
    expect(mulToCents(a, b)).toBe(cents);
  });

  it('rounds negatives away from zero like numeric', () => {
    expect(mulToCents(-12.5, 0.37)).toBe(-463);
  });
});

describe('eurosToCents', () => {
  it('rounds half-up and avoids float errors', () => {
    expect(eurosToCents(1.005)).toBe(101);
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
    expect(eurosToCents('12.345')).toBe(1235);
    expect(eurosToCents(45)).toBe(4500);
    expect(eurosToCents(1e-7)).toBe(0);
  });
  it('rejects non-finite input', () => {
    expect(() => eurosToCents(NaN)).toThrow();
  });
});

describe('formatCents', () => {
  it('formats Slovenian style', () => {
    expect(formatCents(123456)).toBe('1.234,56 €');
    expect(formatCents(0)).toBe('0,00 €');
    expect(formatCents(5)).toBe('0,05 €');
    expect(formatCents(100000000)).toBe('1.000.000,00 €');
    expect(formatCents(-250)).toBe('-2,50 €');
  });
});

describe('parseMoney', () => {
  it('parses Slovenian input', () => {
    expect(parseMoney('12,50')).toBe(1250);
    expect(parseMoney('1.234,56')).toBe(123456);
    expect(parseMoney('1.234,56 €')).toBe(123456);
    expect(parseMoney('0,5')).toBe(50);
    expect(parseMoney('12')).toBe(1200);
    expect(parseMoney('-3,20')).toBe(-320);
  });
  it('accepts dot decimals and dot thousands', () => {
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('1.234')).toBe(123400);
  });
  it('rounds extra decimals half-up', () => {
    expect(parseMoney('4,625')).toBe(463);
  });
  it('rejects garbage', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1,2,3')).toBeNull();
    expect(parseMoney('12,')).toBeNull();
  });
  it('round-trips with formatCents', () => {
    for (const c of [0, 1, 99, 100, 123456, 987654321]) {
      expect(parseMoney(formatCents(c))).toBe(c);
    }
  });
});
