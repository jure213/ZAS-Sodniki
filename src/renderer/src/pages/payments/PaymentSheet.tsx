// One payment: summary, installment history, "Zabeleži plačilo" form (admin) and
// payment edit / delete (admin). Money rules are enforced by the database; the
// server's message (e.g. overpayment) is shown inline.

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatDate, todayIso } from '@shared/dates';
import { PAYMENT_METHOD_LABELS, TARIFF_LABELS } from '@shared/labels';
import { formatCents } from '@shared/money';
import type { PaymentMethod, PaymentTransaction } from '@shared/types';
import { useIsAdmin } from '@/auth/AuthContext';
import { PaymentStatusBadge } from '@/components/badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DateField } from '@/components/DateField';
import { ErrorState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { MoneyInput } from '@/components/MoneyInput';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { isValidationError, qk, useApiMutation } from '@/lib/api';
import { useConfig, usePayment } from '@/lib/hooks';
import { dash } from '@/lib/ui';

const SOURCE_LABELS: Record<PaymentTransaction['source'], string> = {
  app: 'Aplikacija',
  remarks: 'Iz starih opomb',
  inferred: 'Rekonstruirano',
};

const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="rounded-lg border bg-card px-3 py-2.5">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`mt-0.5 font-semibold tabular-nums ${tone ?? ''}`}>{value}</div>
  </div>
);

export function PaymentSheet({ paymentId, onClose }: { paymentId: number | null; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const payment = usePayment(paymentId);
  const config = useConfig();
  const p = payment.data;

  const invalidate = [qk.payments.all, qk.dashboard.all, qk.assignments.all, qk.officials.all];
  const record = useApiMutation('payments:record', { silent: true, invalidate, success: 'Plačilo zabeleženo' });
  const delTx = useApiMutation('payments:deleteTransaction', { invalidate, success: 'Plačilo odstranjeno' });
  const update = useApiMutation('payments:update', { silent: true, invalidate, success: 'Izplačilo shranjeno' });
  const delPayment = useApiMutation('payments:delete', { invalidate, success: 'Izplačilo izbrisano' });

  // --- record form ---
  const [amount, setAmount] = useState<number | null>(null);
  const [paidOn, setPaidOn] = useState(todayIso());
  const [method, setMethod] = useState<PaymentMethod>('gotovina');
  const [note, setNote] = useState('');
  const [recordError, setRecordError] = useState<string | null>(null);

  // --- edit form ---
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingTx, setDeletingTx] = useState<PaymentTransaction | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  // Reset the forms when another payment opens; follow the remaining balance after each change.
  const pid = p?.id;
  const remaining = p?.remaining_cents;
  useEffect(() => {
    setPaidOn(todayIso());
    setNote('');
    setRecordError(null);
    setEditError(null);
  }, [pid]);
  useEffect(() => {
    if (remaining != null) setAmount(remaining > 0 ? remaining : null);
  }, [pid, remaining]);
  useEffect(() => {
    if (config.data) setMethod(config.data.default_payment_method);
  }, [pid, config.data]);
  useEffect(() => {
    if (p) {
      setNotes(p.notes);
      setDue(p.amount_due_cents);
    }
  }, [pid, p?.notes, p?.amount_due_cents]); // eslint-disable-line react-hooks/exhaustive-deps

  const amountError =
    amount == null ? 'Vnesite znesek' : amount <= 0 ? 'Znesek mora biti večji od 0' : p && amount > p.remaining_cents ? `Znesek presega preostanek (${formatCents(p.remaining_cents)})` : undefined;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(paidOn);

  const submitRecord = async () => {
    if (!p || amount == null || amountError || !dateValid) return;
    setRecordError(null);
    try {
      await record.mutateAsync({ payment_id: p.id, amount_cents: amount, paid_on: paidOn, method, note: note.trim() });
      setNote('');
    } catch (e) {
      setRecordError(isValidationError(e) || e instanceof Error ? e.message : 'Plačila ni bilo mogoče zabeležiti.');
    }
  };

  const editDirty = !!p && (notes !== p.notes || due !== p.amount_due_cents);
  const submitEdit = async () => {
    if (!p || due == null) return;
    setEditError(null);
    try {
      await update.mutateAsync({
        id: p.id,
        ...(notes !== p.notes ? { notes } : {}),
        ...(due !== p.amount_due_cents ? { amount_due_cents: due } : {}),
      });
    } catch (e) {
      setEditError(isValidationError(e) || e instanceof Error ? e.message : 'Shranjevanje ni uspelo.');
    }
  };

  return (
    <Sheet open={paymentId != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-2xl">
        <SheetHeader>
          <SheetTitle>Izplačilo</SheetTitle>
          <SheetDescription>{p ? `${p.official_name} · ${p.competition_name} (${formatDate(p.competition_date)})` : ' '}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6">
          {payment.isLoading && <Skeleton className="h-40 w-full" />}
          {payment.error && <ErrorState error={payment.error} onRetry={() => void payment.refetch()} />}
          {p && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Za izplačilo" value={formatCents(p.amount_due_cents)} />
                <Stat label="Plačano" value={formatCents(p.paid_cents)} tone="text-emerald-700" />
                <Stat label="Preostanek" value={formatCents(p.remaining_cents)} tone={p.remaining_cents > 0 ? 'text-amber-700' : ''} />
                <div className="rounded-lg border bg-card px-3 py-2.5">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <PaymentStatusBadge status={p.status} />
                  </div>
                </div>
              </div>
              <p className="-mt-3 text-xs text-muted-foreground">Tarifa: {TARIFF_LABELS[p.tariff]}</p>

              <section className="space-y-2">
                <h3 className="font-medium">Zgodovina plačil</h3>
                {p.transactions.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Še ni zabeleženih plačil.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <tr>
                          <th className="px-3 py-2">Datum</th>
                          <th className="px-3 py-2 text-right">Znesek</th>
                          <th className="px-3 py-2">Način</th>
                          <th className="px-3 py-2">Opomba</th>
                          <th className="px-3 py-2">Vir</th>
                          {isAdmin && <th className="w-10" />}
                        </tr>
                      </thead>
                      <tbody>
                        {p.transactions.map((t) => (
                          <tr key={t.id} className="border-t">
                            <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.paid_on)}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCents(t.amount_cents)}</td>
                            <td className="px-3 py-2">{PAYMENT_METHOD_LABELS[t.method] ?? t.method}</td>
                            <td className="max-w-40 px-3 py-2 break-words">{dash(t.note)}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{SOURCE_LABELS[t.source] ?? t.source}</td>
                            {isAdmin && (
                              <td className="px-1">
                                <Button variant="ghost" size="icon" className="size-8" aria-label="Odstrani plačilo" onClick={() => setDeletingTx(t)}>
                                  <Trash2 />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {p.legacy_remarks && (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium">Stare opombe:</span> {p.legacy_remarks}
                  </p>
                )}
              </section>

              {isAdmin && (
                <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <h3 className="font-medium">Zabeleži plačilo</h3>
                  {p.remaining_cents <= 0 ? (
                    <p className="text-sm text-muted-foreground">Izplačilo je v celoti poravnano.</p>
                  ) : (
                    <form
                      className="space-y-3"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submitRecord();
                      }}
                    >
                      {recordError && (
                        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {recordError}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Znesek" htmlFor="r-amount" error={amount != null || recordError ? amountError : undefined} hint="Možno je tudi delno plačilo.">
                          <MoneyInput id="r-amount" value={amount} onChange={setAmount} invalid={!!amountError && amount != null} />
                        </Field>
                        <Field label="Datum plačila" htmlFor="r-date">
                          <DateField id="r-date" value={paidOn} onChange={setPaidOn} invalid={!dateValid} />
                        </Field>
                        <Field label="Način plačila" htmlFor="r-method">
                          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                            <SelectTrigger id="r-method">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, l]) => (
                                <SelectItem key={k} value={k}>
                                  {l}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Opomba" htmlFor="r-note">
                          <Input id="r-note" value={note} onChange={(e) => setNote(e.target.value)} />
                        </Field>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setAmount(p.remaining_cents)}>
                          Celoten preostanek
                        </Button>
                        <Button type="submit" disabled={record.isPending || !!amountError || !dateValid}>
                          {record.isPending ? 'Shranjujem…' : 'Zabeleži plačilo'}
                        </Button>
                      </div>
                    </form>
                  )}
                </section>
              )}

              {isAdmin && (
                <section className="space-y-3">
                  <h3 className="font-medium">Podrobnosti izplačila</h3>
                  {editError && (
                    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {editError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Znesek za izplačilo" htmlFor="p-due" hint="Ročni popravek zneska, ustvarjenega iz tarife.">
                      <MoneyInput id="p-due" value={due} onChange={setDue} />
                    </Field>
                  </div>
                  <Field label="Opombe" htmlFor="p-notes">
                    <Textarea id="p-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </Field>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        disabled={p.installments > 0}
                        onClick={() => setDeletingPayment(true)}
                      >
                        <Trash2 /> Izbriši izplačilo
                      </Button>
                      {p.installments > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">Izplačila s plačili ni mogoče izbrisati – najprej odstranite plačila.</p>
                      )}
                    </div>
                    <Button type="button" disabled={!editDirty || due == null || update.isPending} onClick={() => void submitEdit()}>
                      {update.isPending ? 'Shranjujem…' : 'Shrani'}
                    </Button>
                  </div>
                </section>
              )}

              {!isAdmin && p.notes && (
                <section>
                  <h3 className="mb-1 font-medium">Opombe</h3>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{p.notes}</p>
                </section>
              )}
            </>
          )}
        </SheetBody>
      </SheetContent>

      <ConfirmDialog
        open={!!deletingTx}
        onOpenChange={(o) => !o && setDeletingTx(null)}
        title="Odstranitev plačila"
        description={`Ali res želite odstraniti plačilo ${deletingTx ? formatCents(deletingTx.amount_cents) : ''} z dne ${formatDate(deletingTx?.paid_on)}? Preostanek izplačila se bo povečal.`}
        confirmLabel="Odstrani"
        destructive
        onConfirm={() => deletingTx && delTx.mutate({ id: deletingTx.id })}
      />
      <ConfirmDialog
        open={deletingPayment}
        onOpenChange={setDeletingPayment}
        title="Izbris izplačila"
        description="Ali res želite izbrisati to izplačilo? Dodelitev ostane, izplačilo pa lahko znova generirate."
        confirmLabel="Izbriši"
        destructive
        onConfirm={() => p && delPayment.mutate({ id: p.id }, { onSuccess: onClose })}
      />
    </Sheet>
  );
}
