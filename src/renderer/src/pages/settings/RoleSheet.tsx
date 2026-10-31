// Role editor: name + two tier tables (sodnik / račun). Tiers are flat amounts per
// assignment: a tier applies when hours > from and hours <= to (empty "to" = no limit).

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type { Role } from '@shared/types';
import { Field } from '@/components/Field';
import { MoneyInput } from '@/components/MoneyInput';
import { useUnsavedGuard } from '@/components/useUnsavedGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { qk, useApiMutation } from '@/lib/api';
import { appendRow, rowsToTiers, toRows, validateTiers, type TierRow } from './tiers';

function TierEditor({
  title,
  rows,
  onChange,
  showErrors,
}: {
  title: string;
  rows: TierRow[];
  onChange: (rows: TierRow[]) => void;
  showErrors: boolean;
}) {
  const problems = useMemo(() => validateTiers(rows), [rows]);
  const patch = (key: number, p: Partial<TierRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(appendRow(rows))}>
          <Plus /> Dodaj razpon
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          Ni razponov – znesek bo 0 €.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[1fr_1fr_1.3fr_2.25rem] gap-2 bg-muted px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <span>Od (ur, več kot)</span>
            <span>Do (ur) </span>
            <span>Znesek</span>
            <span />
          </div>
          {rows.map((r) => (
            <div key={r.key} className="border-t px-3 py-2">
              <div className="grid grid-cols-[1fr_1fr_1.3fr_2.25rem] items-center gap-2">
                <Input aria-label="Od" inputMode="decimal" value={r.from} onChange={(e) => patch(r.key, { from: e.target.value })} />
                <Input
                  aria-label="Do"
                  inputMode="decimal"
                  placeholder="∞"
                  value={r.to}
                  onChange={(e) => patch(r.key, { to: e.target.value })}
                />
                <MoneyInput value={r.rate} onChange={(c) => patch(r.key, { rate: c })} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label="Odstrani razpon"
                  onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
                >
                  <Trash2 />
                </Button>
              </div>
              {showErrors && problems.rows[r.key] && <p className="mt-1 text-xs text-destructive">{problems.rows[r.key]}</p>}
            </div>
          ))}
        </div>
      )}
      {problems.general.map((g) => (
        <p key={g} className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {g}
        </p>
      ))}
    </section>
  );
}

export function RoleSheet({ open, onOpenChange, role }: { open: boolean; onOpenChange: (o: boolean) => void; role?: Role }) {
  const [name, setName] = useState('');
  const [rates, setRates] = useState<TierRow[]>([]);
  const [invoice, setInvoice] = useState<TierRow[]>([]);
  const [initial, setInitial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const snapshot = (n: string, a: TierRow[], b: TierRow[]) =>
    JSON.stringify([n, a.map(({ key: _k, ...r }) => r), b.map(({ key: _k, ...r }) => r)]);

  useEffect(() => {
    if (!open) return;
    const a = toRows(role?.rates ?? []);
    const b = toRows(role?.invoiceRates ?? []);
    setName(role?.name ?? '');
    setRates(a);
    setInvoice(b);
    setInitial(snapshot(role?.name ?? '', a, b));
    setError(null);
    setShowErrors(false);
  }, [open, role]);

  const dirty = open && snapshot(name, rates, invoice) !== initial;
  const { guard, dialog } = useUnsavedGuard(dirty);
  const save = useApiMutation('roles:save', { silent: true, invalidate: [qk.roles.all], success: 'Vloga shranjena' });

  function submit() {
    setShowErrors(true);
    setError(null);
    if (!name.trim()) return setError('Vnesite ime vloge');
    const pa = validateTiers(rates);
    const pb = validateTiers(invoice);
    if (Object.keys(pa.rows).length || Object.keys(pb.rows).length) return setError('Popravite označene razpone.');
    const overlap = [...pa.general, ...pb.general].find((g) => g.startsWith('Razponi'));
    if (overlap) return setError(overlap);
    save.mutate(
      {
        id: role?.id,
        name: name.trim(),
        rates: rowsToTiers(rates),
        invoiceRates: rowsToTiers(invoice),
        archived: role?.archived ?? false,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (e) => setError(e.message),
      },
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : guard(() => onOpenChange(false)))}>
        <SheetContent className="max-w-2xl">
          <SheetHeader>
            <SheetTitle>{role ? 'Uredi vlogo' : 'Nova vloga'}</SheetTitle>
            <SheetDescription>
              Tarifa določa znesek glede na število ur: razpon velja, ko je ur več kot »Od« in največ »Do«. Prazno »Do« pomeni brez zgornje meje.
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-6">
            {error && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Field label="Ime vloge" htmlFor="r-name" required>
              <Input id="r-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <TierEditor title="Tarifa za sodnika" rows={rates} onChange={setRates} showErrors={showErrors} />
            <TierEditor title="Tarifa za račun" rows={invoice} onChange={setInvoice} showErrors={showErrors} />
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => guard(() => onOpenChange(false))}>
              Prekliči
            </Button>
            <Button disabled={save.isPending} onClick={submit}>
              {save.isPending ? 'Shranjujem…' : 'Shrani'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  );
}
