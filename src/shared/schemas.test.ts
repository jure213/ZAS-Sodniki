import { describe, expect, it } from 'vitest';
import { assignmentSchema, auditQuery, competitionSchema, loginSchema, recordPaymentSchema, tierSchema } from './schemas';

const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe('schemas (Slovenian messages)', () => {
  it('login requires username and password', () => {
    expect(msg(loginSchema.safeParse({ username: ' ', password: 'x' }))).toBe('Vnesite uporabniško ime');
    expect(msg(loginSchema.safeParse({ username: 'a', password: '' }))).toBe('Vnesite geslo');
    expect(loginSchema.parse({ username: ' jure ', password: 'x' })).toEqual({
      username: 'jure',
      password: 'x',
      remember: false,
    });
  });
  it('competition validates calendar dates', () => {
    const base = { name: 'Miting', status: 'planned' };
    expect(competitionSchema.safeParse({ ...base, date: '2025-03-07' }).success).toBe(true);
    expect(msg(competitionSchema.safeParse({ ...base, date: '2025-02-30' }))).toBe('Neveljaven datum');
    expect(msg(competitionSchema.safeParse({ ...base, date: '7.3.2025' }))).toBe('Neveljaven datum');
  });
  it('tier upper bound must exceed lower bound', () => {
    expect(tierSchema.safeParse({ from: 0, to: null, rate: 10 }).success).toBe(true);
    expect(msg(tierSchema.safeParse({ from: 2, to: 2, rate: 10 }))).toBe('Zgornja meja mora biti večja od začetka');
  });
  it('assignment rejects negative hours/km', () => {
    const ok = { competition_id: 1, official_id: 2, role_id: 3, hours: 2, kilometers: 10 };
    expect(assignmentSchema.safeParse(ok).success).toBe(true);
    expect(msg(assignmentSchema.safeParse({ ...ok, hours: -1 }))).toBe('Ure ne smejo biti negativne');
  });
  it('payment amount must be positive integer cents', () => {
    const ok = { payment_id: 1, amount_cents: 1250, paid_on: '2025-03-07', method: 'gotovina' };
    expect(recordPaymentSchema.safeParse(ok).success).toBe(true);
    expect(msg(recordPaymentSchema.safeParse({ ...ok, amount_cents: 0 }))).toBe('Znesek mora biti večji od 0');
  });
  it('audit query has paging defaults and validates filters', () => {
    expect(auditQuery.parse({})).toEqual({ limit: 100, offset: 0 });
    expect(auditQuery.parse({ search: '  Novak ', entity: 'payment', from: '2026-01-31', userId: 3 })).toMatchObject({
      search: 'Novak',
      entity: 'payment',
    });
    expect(auditQuery.safeParse({ entity: 'settings' }).success).toBe(false);
    expect(auditQuery.safeParse({ from: '2026-02-30' }).success).toBe(false);
    expect(auditQuery.safeParse({ limit: 0 }).success).toBe(false);
    expect(auditQuery.safeParse({ limit: 501 }).success).toBe(false);
    expect(auditQuery.safeParse({ offset: -1 }).success).toBe(false);
    expect(auditQuery.safeParse({ search: 'x'.repeat(101) }).success).toBe(false);
  });
});
