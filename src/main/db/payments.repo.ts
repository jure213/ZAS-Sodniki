// Payments. The database is the authority for money: payments are created by
// generate_payments(), installments by record_payment() (which locks the row
// and refuses overpayment), and balances come from the payment_balances view.
import type { z } from 'zod';
import type { paymentFilterSchema } from '@shared/schemas';
import { centsToEuros } from '@shared/money';
import type { GenerateResult, PaymentDetail, PaymentRow, PaymentTransaction } from '@shared/types';
import type { Tariff } from '@shared/tariff';
import { AppError } from '../ipc/errors';
import { db, unwrap } from './client';
import { cents, compStatus, method, num, status, tariff, text, type Row } from './rows';

export type PaymentFilterInput = z.output<typeof paymentFilterSchema>;

const toRow = (r: Row): PaymentRow => ({
  id: Number(r.id),
  assignment_id: r.assignment_id == null ? null : Number(r.assignment_id),
  official_id: Number(r.official_id),
  official_name: text(r.official_name),
  competition_id: Number(r.competition_id),
  competition_name: text(r.competition_name),
  competition_date: text(r.competition_date),
  competition_status: compStatus(r.competition_status),
  tariff: tariff(r.tariff),
  amount_due_cents: cents(r.amount_due),
  paid_cents: cents(r.paid_total),
  remaining_cents: cents(r.remaining),
  status: status(r.status),
  last_paid_on: r.last_paid_on ?? null,
  installments: num(r.installments),
  notes: text(r.notes),
});

const toTransaction = (r: Row): PaymentTransaction => ({
  id: Number(r.id),
  payment_id: Number(r.payment_id),
  amount_cents: cents(r.amount),
  paid_on: text(r.paid_on),
  method: method(r.method),
  note: text(r.note),
  source: r.source,
});

/** Newest competition first. The date filter applies to the competition date. */
export async function listPayments(filter: PaymentFilterInput = { hide_zero: false }): Promise<PaymentRow[]> {
  let q = db.rest.from('payment_balances').select('*');
  if (filter.official_id) q = q.eq('official_id', filter.official_id);
  if (filter.competition_id) q = q.eq('competition_id', filter.competition_id);
  if (filter.status === 'open') q = q.in('status', ['owed', 'partial']);
  else if (filter.status) q = q.eq('status', filter.status);
  if (filter.date_from) q = q.gte('competition_date', filter.date_from);
  if (filter.date_to) q = q.lte('competition_date', filter.date_to);
  if (filter.hide_zero) q = q.gt('amount_due', 0);
  const rows = unwrap(await q.order('competition_date', { ascending: false }).order('id', { ascending: false }));
  return (rows as Row[]).map(toRow);
}

export async function getPayment(id: number): Promise<PaymentDetail> {
  const row = unwrap(await db.rest.from('payment_balances').select('*').eq('id', id).single()) as Row;
  const tx = unwrap(
    await db.rest
      .from('payment_transactions')
      .select('id, payment_id, amount, paid_on, method, note, source')
      .eq('payment_id', id)
      .order('paid_on')
      .order('id'),
  ) as Row[];
  return { ...toRow(row), legacy_remarks: text(row.legacy_remarks), transactions: tx.map(toTransaction) };
}

export async function generatePayments(competitionId: number, t: Tariff): Promise<GenerateResult> {
  return unwrap(await db.rest.rpc('generate_payments', { competition_id: competitionId, tariff: t })) as GenerateResult;
}

export async function recordPayment(input: {
  payment_id: number;
  amount_cents: number;
  paid_on: string;
  method: string;
  note: string;
}): Promise<number> {
  const id = unwrap(
    await db.rest.rpc('record_payment', {
      payment_id: input.payment_id,
      amount: centsToEuros(input.amount_cents),
      paid_on: input.paid_on,
      method: input.method,
      note: input.note,
    }),
  );
  return Number(id);
}

export async function deleteTransaction(id: number): Promise<void> {
  unwrap(await db.rest.rpc('delete_payment_transaction', { id }));
}

export async function updatePayment(id: number, patch: { notes?: string; amount_due_cents?: number }): Promise<void> {
  const fields: Row = {};
  if (patch.notes !== undefined) fields.notes = patch.notes;
  if (patch.amount_due_cents !== undefined) fields.amount_due = centsToEuros(patch.amount_due_cents);
  if (Object.keys(fields).length === 0) return;
  unwrap(await db.rest.from('payments').update(fields).eq('id', id).select('id').single());
}

/** A payment with installments cannot be deleted; remove the installments first. */
export async function deletePayment(id: number): Promise<void> {
  const row = unwrap(
    await db.rest.from('payment_balances').select('installments').eq('id', id).maybeSingle(),
  ) as Row | null;
  if (row && num(row.installments) > 0) {
    throw new AppError('IN_USE', 'Izplačila s plačili ni mogoče izbrisati. Najprej odstranite plačila.');
  }
  unwrap(await db.rest.from('payments').delete().eq('id', id));
}
