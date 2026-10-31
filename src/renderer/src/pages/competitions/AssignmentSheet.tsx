// Edit one assignment with a LIVE calculation: base / travel / total for both tariffs,
// computed with the shared tariff module (same rules as the server). Base amounts can
// be overridden by hand; "Preračunaj po tarifi" resets them to the current tariff.

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { formatCents } from '@shared/money';
import { computeAssignment, isUnpaidStatus } from '@shared/tariff';
import type { Assignment, Competition } from '@shared/types';
import { Field } from '@/components/Field';
import { MoneyInput } from '@/components/MoneyInput';
import { PaymentStatusBadge } from '@/components/badges';
import { useUnsavedGuard } from '@/components/useUnsavedGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { isValidationError, qk, useApiMutation } from '@/lib/api';
import { useConfig, useDisciplines, useRoles } from '@/lib/hooks';
import { num, parseDecimal } from '@/lib/ui';

const NONE = '__none__';

type FormState = { role_id: string; discipline_id: string; hours: string; kilometers: string; notes: string };

const toForm = (a: Assignment): FormState => ({
  role_id: String(a.role_id),
  discipline_id: a.discipline_id == null ? NONE : String(a.discipline_id),
  hours: num(a.hours),
  kilometers: num(a.kilometers),
  notes: a.notes,
});

export function AssignmentSheet({
  competition,
  assignment,
  onClose,
}: {
  competition: Competition;
  assignment: Assignment | null;
  onClose: () => void;
}) {
  const open = !!assignment;
  const roles = useRoles();
  const disciplines = useDisciplines();
  const config = useConfig();

  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  // null = not overridden. Values are cents.
  const [override, setOverride] = useState<{ sodnik: number | null; racun: number | null }>({ sodnik: null, racun: null });
  const [forceRecalc, setForceRecalc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assignment) {
      const f = toForm(assignment);
      setForm(f);
      setInitial(f);
      setOverride({ sodnik: null, racun: null });
      setForceRecalc(false);
      setError(null);
    }
  }, [assignment]);

  const dirty =
    !!form && !!initial && (JSON.stringify(form) !== JSON.stringify(initial) || override.sodnik != null || override.racun != null || forceRecalc);
  const { guard, dialog } = useUnsavedGuard(dirty);

  const save = useApiMutation('assignments:save', {
    silent: true,
    invalidate: [qk.assignments.all, qk.officials.all, qk.payments.all, qk.dashboard.all],
    success: 'Dodelitev shranjena',
  });

  const role = roles.data?.find((r) => String(r.id) === form?.role_id);
  const hours = form ? parseDecimal(form.hours) : null;
  const km = form ? parseDecimal(form.kilometers) : null;

  const errors = {
    role: form && !role ? 'Izberite vlogo' : undefined,
    hours: hours == null ? 'Vnesite ure' : hours < 0 ? 'Ure ne smejo biti negativne' : hours > 100 ? 'Preveč ur' : undefined,
    km: km == null ? 'Vnesite kilometre' : km < 0 ? 'Kilometri ne smejo biti negativni' : km > 10000 ? 'Preveč kilometrov' : undefined,
  };
  const valid = !errors.role && !errors.hours && !errors.km;

  const calc = useMemo(() => {
    if (!assignment || !role || hours == null || km == null) return null;
    // Same rule as the server: the stored snapshot is kept unless role / hours changed or a recalculation is requested.
    const recompute = forceRecalc || role.id !== assignment.role_id || hours !== assignment.hours;
    const rate = recompute ? (config.data?.travel_cost_per_km ?? assignment.travel_rate) : assignment.travel_rate;
    const auto = computeAssignment({ role, hours, kilometers: km, travelRate: rate, status: competition.status });
    const baseSodnik = override.sodnik ?? (recompute ? auto.baseSodnik : assignment.base_sodnik_cents);
    const baseRacun = override.racun ?? (recompute ? auto.baseRacun : assignment.base_racun_cents);
    const travel = auto.travel;
    return {
      auto,
      baseSodnik,
      baseRacun,
      travel,
      totalSodnik: baseSodnik + travel,
      totalRacun: baseRacun + travel,
      // Stored amount differs from what the tariff says now (manual or older tariff).
      differs: baseSodnik !== auto.baseSodnik || baseRacun !== auto.baseRacun,
    };
  }, [assignment, role, hours, km, forceRecalc, override, config.data, competition.status]);

  const unpaid = isUnpaidStatus(competition.status);
  const set = (p: Partial<FormState>) => setForm((f) => (f ? { ...f, ...p } : f));

  const submit = async () => {
    if (!assignment || !form || !valid || hours == null || km == null) return;
    setError(null);
    try {
      await save.mutateAsync({
        id: assignment.id,
        competition_id: assignment.competition_id,
        official_id: assignment.official_id,
        role_id: Number(form.role_id),
        discipline_id: form.discipline_id === NONE ? null : Number(form.discipline_id),
        hours,
        kilometers: km,
        notes: form.notes.trim(),
        base_sodnik_cents: override.sodnik,
        base_racun_cents: override.racun,
        recalculate: forceRecalc,
      });
      setInitial(form);
      setOverride({ sodnik: null, racun: null });
      setForceRecalc(false);
      onClose();
    } catch (e) {
      setError(isValidationError(e) || e instanceof Error ? e.message : 'Shranjevanje ni uspelo.');
    }
  };

  const roleOptions = (roles.data ?? []).filter((r) => !r.archived || r.id === assignment?.role_id);
  const discOptions = (disciplines.data ?? []).filter((d) => !d.archived || d.id === assignment?.discipline_id);

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && guard(onClose)}>
        <SheetContent className="max-w-xl">
          <form
            className="flex h-full flex-col"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <SheetHeader>
              <SheetTitle>Uredi dodelitev</SheetTitle>
              <SheetDescription>
                {assignment?.official_name} · {competition.name}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-5">
              {error && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              {assignment?.payment && (
                <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    Za to dodelitev že obstaja izplačilo (<PaymentStatusBadge status={assignment.payment.status} />, znesek{' '}
                    {formatCents(assignment.payment.amount_due_cents)}). Sprememba zneskov ne spremeni že ustvarjenega izplačila – njegov znesek
                    uredite na strani Izplačila.
                  </div>
                </div>
              )}
              {unpaid && (
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Tekmovanje ima status »{competition.status === 'free' ? 'Zastonj' : 'Plača drug ZAS'}« – zneski in potni stroški so 0 €.
                </p>
              )}
              {form && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Vloga" htmlFor="a-role" required error={errors.role}>
                      <Select value={form.role_id} onValueChange={(v) => set({ role_id: v })}>
                        <SelectTrigger id="a-role" aria-invalid={!!errors.role}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.name}
                              {r.archived ? ' (arhivirana)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Disciplina" htmlFor="a-disc">
                      <Select value={form.discipline_id} onValueChange={(v) => set({ discipline_id: v })}>
                        <SelectTrigger id="a-disc">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Brez discipline</SelectItem>
                          {discOptions.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {d.name}
                              {d.archived ? ' (arhivirana)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Ure" htmlFor="a-hours" required error={errors.hours}>
                      <Input
                        id="a-hours"
                        inputMode="decimal"
                        value={form.hours}
                        aria-invalid={!!errors.hours}
                        onChange={(e) => set({ hours: e.target.value })}
                      />
                    </Field>
                    <Field label="Kilometri" htmlFor="a-km" required error={errors.km}>
                      <Input
                        id="a-km"
                        inputMode="decimal"
                        value={form.kilometers}
                        aria-invalid={!!errors.km}
                        onChange={(e) => set({ kilometers: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Opombe" htmlFor="a-notes">
                    <Textarea id="a-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
                  </Field>

                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Izračun zneskov</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!calc || (!calc.differs && !forceRecalc && override.sodnik == null && override.racun == null)}
                        onClick={() => {
                          setOverride({ sodnik: null, racun: null });
                          setForceRecalc(true);
                        }}
                      >
                        <RotateCcw /> Preračunaj po tarifi
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 bg-muted px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <span />
                        <span className="text-right">Sodnik</span>
                        <span className="text-right">Račun</span>
                      </div>
                      <div className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2 border-t px-3 py-2">
                        <span className="text-sm">Osnova</span>
                        <MoneyInput
                          id="a-base-sodnik"
                          value={calc ? calc.baseSodnik : null}
                          disabled={!calc}
                          onChange={(c) => c != null && setOverride((o) => ({ ...o, sodnik: c }))}
                        />
                        <MoneyInput
                          id="a-base-racun"
                          value={calc ? calc.baseRacun : null}
                          disabled={!calc}
                          onChange={(c) => c != null && setOverride((o) => ({ ...o, racun: c }))}
                        />
                      </div>
                      <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 border-t px-3 py-2 text-sm tabular-nums">
                        <span className="font-sans">Potni stroški</span>
                        <span className="text-right">{calc ? formatCents(calc.travel) : '–'}</span>
                        <span className="text-right">{calc ? formatCents(calc.travel) : '–'}</span>
                      </div>
                      <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 border-t bg-muted/50 px-3 py-2 text-sm font-semibold tabular-nums">
                        <span>Skupaj</span>
                        <span className="text-right" data-testid="live-total-sodnik">
                          {calc ? formatCents(calc.totalSodnik) : '–'}
                        </span>
                        <span className="text-right" data-testid="live-total-racun">
                          {calc ? formatCents(calc.totalRacun) : '–'}
                        </span>
                      </div>
                    </div>
                    {calc && calc.differs && !unpaid && (
                      <p className="text-xs text-amber-700">
                        Osnova se razlikuje od trenutne tarife (sodnik {formatCents(calc.auto.baseSodnik)}, račun {formatCents(calc.auto.baseRacun)}) –
                        zamrznjen ali ročno vnesen znesek.
                      </p>
                    )}
                    {calc && !calc.differs && (override.sodnik != null || override.racun != null) && (
                      <p className="text-xs text-muted-foreground">Znesek se ujema s tarifo.</p>
                    )}
                    {!calc && <p className="text-xs text-muted-foreground">Izberite vlogo ter vnesite ure in kilometre.</p>}
                    <p className="text-xs text-muted-foreground">
                      Zneske lahko prepišete ročno; ob spremembi vloge ali ur se osnova preračuna po tarifi.
                    </p>
                  </section>
                </>
              )}
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => guard(onClose)}>
                Prekliči
              </Button>
              <Button type="submit" disabled={save.isPending || !valid}>
                {save.isPending ? 'Shranjujem…' : 'Shrani'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  );
}
