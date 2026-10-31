// Row mapping between PostgREST JSON (numeric as number, text columns nullable)
// and the IPC types (integer cents, never null for text).
import { eurosToCents } from '@shared/money';
import type { PaymentMethod, PaymentStatus, PaymentSummary } from '@shared/types';
import type { CompetitionStatus, Tariff } from '@shared/tariff';

export type Row = Record<string, any>;

export const text = (v: unknown): string => (v == null ? '' : String(v));
export const num = (v: unknown): number => (v == null ? 0 : Number(v));
export const cents = (v: unknown): number => (v == null ? 0 : eurosToCents(v as number));
export const status = (v: unknown) => v as PaymentStatus;
export const method = (v: unknown) => v as PaymentMethod;
export const compStatus = (v: unknown) => v as CompetitionStatus;
export const tariff = (v: unknown) => v as Tariff;

/** Payment columns of assignment_details / payment_balances, or null when there is no payment. */
export function paymentSummary(r: Row, prefix: { id: string; tariff: string; status: string }): PaymentSummary | null {
  if (r[prefix.id] == null) return null;
  return {
    id: Number(r[prefix.id]),
    tariff: tariff(r[prefix.tariff]),
    amount_due_cents: cents(r.amount_due),
    paid_cents: cents(r.paid_total),
    remaining_cents: cents(r.remaining),
    status: status(r[prefix.status]),
  };
}
