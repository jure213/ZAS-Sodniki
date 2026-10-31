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

function fromPostgres(e: ApiError): IpcError {
  const { pgCode: code, status } = e;
  if (code === '23505') return { code: 'CONFLICT', message: MESSAGES.CONFLICT };
  if (code === '42501') return { code: 'FORBIDDEN', message: MESSAGES.FORBIDDEN };
  if (code === '23503') return { code: 'IN_USE', message: MESSAGES.IN_USE };
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303') {
    return { code: 'SESSION_EXPIRED', message: MESSAGES.SESSION_EXPIRED };
  }
  if (!status && NETWORK_RE.test(e.message)) return { code: 'NETWORK', message: MESSAGES.NETWORK };
  // Messages raised by our SQL functions (RAISE EXCEPTION) are already Slovenian.
  return { code: 'UNKNOWN', message: e.message || MESSAGES.UNKNOWN };
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
