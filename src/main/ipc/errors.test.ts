import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { ApiError } from '../db/client';
import { AppError, toIpcError } from './errors';

const pg = (message: string, code: string | undefined, status = 400) => toIpcError(new ApiError(message, code, status));

describe('toIpcError', () => {
  it('maps unique violations to CONFLICT, with a friendly message for known constraints', () => {
    expect(pg('duplicate key value violates unique constraint "foo"', '23505', 409)).toEqual({
      code: 'CONFLICT',
      message: 'Zapis s to vrednostjo že obstaja.',
    });
    expect(
      pg('duplicate key value violates unique constraint "competition_officials_one_per_competition"', '23505', 409),
    ).toEqual({ code: 'CONFLICT', message: 'Sodnik je že dodeljen temu tekmovanju.' });
    // raised by our own SQL function: its Slovenian text is kept
    expect(pg('Vloga s tem imenom že obstaja.', '23505', 409).message).toBe('Vloga s tem imenom že obstaja.');
  });

  it('maps 42501 to FORBIDDEN and hides the English PostgreSQL text', () => {
    expect(pg('permission denied for table officials', '42501', 403)).toEqual({
      code: 'FORBIDDEN',
      message: 'Nimate dovoljenja za to dejanje.',
    });
  });

  it('maps foreign key violations: deleting a referenced row is IN_USE, a missing reference is a validation problem', () => {
    expect(
      pg('update or delete on table "officials" violates foreign key constraint "x" on table "y"', '23503', 409).code,
    ).toBe('IN_USE');
    expect(pg('insert or update on table "y" violates foreign key constraint "x"', '23503', 409)).toEqual({
      code: 'VALIDATION',
      message: 'Povezani zapis ne obstaja.',
    });
  });

  it('maps function-raised errors to VALIDATION with the Slovenian message', () => {
    for (const code of ['22023', 'P0001', 'P0002', '23514']) {
      expect(pg('Znesek plačila mora biti večji od 0.', code)).toEqual({
        code: 'VALIDATION',
        message: 'Znesek plačila mora biti večji od 0.',
      });
    }
    // a plain check violation from PostgreSQL gets the generic Slovenian text
    expect(pg('new row for relation "x" violates check constraint "y"', '23514')).toEqual({
      code: 'VALIDATION',
      message: 'Neveljavni podatki.',
    });
  });

  it('maps expired sessions and network failures', () => {
    expect(pg('JWT expired', 'PGRST303', 401).code).toBe('SESSION_EXPIRED');
    expect(pg('whatever', undefined, 401).code).toBe('SESSION_EXPIRED');
    expect(toIpcError(new ApiError('TypeError: fetch failed', '', 0))).toEqual({
      code: 'NETWORK',
      message: 'Strežnik ni dosegljiv',
    });
    expect(toIpcError(new TypeError('fetch failed')).code).toBe('NETWORK');
  });

  it('maps missing rows, app errors and zod errors', () => {
    expect(pg('JSON object requested, multiple (or no) rows returned', 'PGRST116', 406)).toEqual({
      code: 'VALIDATION',
      message: 'Zapis ne obstaja.',
    });
    expect(toIpcError(new AppError('IN_USE', 'Zasedeno'))).toEqual({ code: 'IN_USE', message: 'Zasedeno' });
    const zerr = z.object({ a: z.string({ error: 'Vnesite a' }) }).safeParse({}).error as ZodError;
    expect(toIpcError(zerr)).toEqual({ code: 'VALIDATION', message: 'Vnesite a' });
  });
});
