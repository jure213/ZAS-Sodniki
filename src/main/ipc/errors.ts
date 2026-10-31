import { ZodError } from 'zod';
import type { ErrorCode, IpcError } from '@shared/ipc';
import { ApiError } from '../db/client';

/** An error thrown deliberately by a handler, with a code and a Slovenian message. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const MESSAGES = {
  CONFLICT: 'Zapis s to vrednostjo že obstaja.',
  FORBIDDEN: 'Nimate dovoljenja za to dejanje.',
  IN_USE: 'Zapisa ni mogoče izbrisati, ker se še uporablja.',
  SESSION_EXPIRED: 'Seja je potekla. Prijavite se znova.',
  NETWORK: 'Strežnik ni dosegljiv',
  VALIDATION: 'Neveljavni podatki.',
  UNKNOWN: 'Neznana napaka',
} as const;

const NETWORK_RE = /fetch failed|failed to fetch|econnrefused|enotfound|etimedout|econnreset|network|socket/i;

/** PostgreSQL's own (English) messages, as opposed to the Slovenian ones our SQL functions raise. */
const PG_BOILERPLATE =
  /duplicate key|violates|permission denied|null value|invalid input|out of range|could not|row-level security|JWT|does not exist|syntax error/i;

/** Friendly message for a unique violation, chosen by constraint name. */
const CONFLICT_BY_CONSTRAINT: [RegExp, string][] = [
  [/competition_officials_one_per_competition/, 'Sodnik je že dodeljen temu tekmovanju.'],
  [/users_username/, 'Uporabniško ime že obstaja.'],
  [/roles_name_key/, 'Vloga s tem imenom že obstaja.'],
  [/disciplines_name_key/, 'Disciplina s tem imenom že obstaja.'],
  [/payments_assignment_id_key/, 'Izplačilo za to dodelitev že obstaja.'],
];

function ownMessage(e: ApiError, fallback: string): string {
  return e.message && !PG_BOILERPLATE.test(e.message) ? e.message : fallback;
}

function fromPostgres(e: ApiError): IpcError {
  const { pgCode: code, status } = e;
  if (code === '23505') {
    const known = CONFLICT_BY_CONSTRAINT.find(([re]) => re.test(e.message));
    return { code: 'CONFLICT', message: known?.[1] ?? ownMessage(e, MESSAGES.CONFLICT) };
  }
  if (code === '42501') return { code: 'FORBIDDEN', message: ownMessage(e, MESSAGES.FORBIDDEN) };
  if (code === '23503') {
    // Deleting a row that others reference. Inserting a reference to a missing row is a validation problem.
    if (/update or delete on table/i.test(e.message)) return { code: 'IN_USE', message: MESSAGES.IN_USE };
    return { code: 'VALIDATION', message: 'Povezani zapis ne obstaja.' };
  }
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303') {
    return { code: 'SESSION_EXPIRED', message: MESSAGES.SESSION_EXPIRED };
  }
  if (code === 'PGRST116') return { code: 'VALIDATION', message: 'Zapis ne obstaja.' };
  // Messages raised by our SQL functions and triggers (RAISE EXCEPTION) are Slovenian.
  if (code && ['22023', 'P0001', 'P0002', '23514', '23502', '22P02', '22003', '22007'].includes(code)) {
    return { code: 'VALIDATION', message: ownMessage(e, MESSAGES.VALIDATION) };
  }
  if (!status && NETWORK_RE.test(e.message)) return { code: 'NETWORK', message: MESSAGES.NETWORK };
  return { code: 'UNKNOWN', message: ownMessage(e, MESSAGES.UNKNOWN) };
}

/** Maps anything thrown inside a handler to a transport-safe error. */
export function toIpcError(e: unknown): IpcError {
  if (e instanceof AppError) return { code: e.code, message: e.message };
  if (e instanceof ZodError) {
    return { code: 'VALIDATION', message: e.issues[0]?.message ?? MESSAGES.VALIDATION };
  }
  if (e instanceof ApiError) return fromPostgres(e);
  if (e instanceof TypeError || (e instanceof Error && NETWORK_RE.test(e.message))) {
    return { code: 'NETWORK', message: MESSAGES.NETWORK };
  }
  console.error('Unhandled IPC error:', e);
  return { code: 'UNKNOWN', message: MESSAGES.UNKNOWN };
}
