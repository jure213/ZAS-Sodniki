// "Dodaj sodnike": pick several active, not-yet-assigned officials and set role / discipline /
// hours / km per row with live totals. Defaults can be applied to every row at once.

import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { formatCents } from '@shared/money';
import { computeAssignment } from '@shared/tariff';
import type { Assignment, Competition } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { qk, useApiMutation } from '@/lib/api';
import { useConfig, useDisciplines, useOfficials, useRoles } from '@/lib/hooks';
import { normalize } from '@/lib/text';
import { cn } from '@/lib/utils';
import { parseDecimal } from '@/lib/ui';

const NONE = '__none__';
type Row = { official_id: number; role_id: string; discipline_id: string; hours: string; kilometers: string };
type Defaults = Omit<Row, 'official_id'>;
const DEFAULTS: Defaults = { role_id: '', discipline_id: NONE, hours: '4', kilometers: '0' };

const roleSelect = 'h-8 text-xs';

export function BulkAddDialog({
  open,
  onOpenChange,
  competition,
  assignments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: Competition;
  assignments: Assignment[];
}) {
  const officials = useOfficials();
  const roles = useRoles();
  const disciplines = useDisciplines();
  const config = useConfig();

  const [search, setSearch] = useState('');
  const [defaults, setDefaults] = useState<Defaults>(DEFAULTS);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setDefaults(DEFAULTS);
      setRows([]);
      setError(null);
    }
  }, [open]);

  const bulk = useApiMutation('assignments:bulkAdd', {
    silent: true,
    invalidate: [qk.assignments.all, qk.officials.all],
  });

  const taken = useMemo(() => new Set(assignments.map((a) => a.official_id)), [assignments]);
  const available = useMemo(
    () => (officials.data ?? []).filter((o) => o.active && !taken.has(o.id)).sort((a, b) => a.name.localeCompare(b.name, 'sl')),
    [officials.data, taken],
  );
  const shown = useMemo(() => {
    const n = normalize(search).trim();
    return n ? available.filter((o) => normalize(`${o.name} ${o.rank}`).includes(n)) : available;
  }, [available, search]);

  const selected = new Set(rows.map((r) => r.official_id));
  const nameOf = (id: number) => officials.data?.find((o) => o.id === id)?.name ?? '';

  const add = (ids: number[]) =>
    setRows((prev) => [...prev, ...ids.filter((id) => !prev.some((r) => r.official_id === id)).map((id) => ({ official_id: id, ...defaults }))]);
  const toggle = (id: number, on: boolean) => (on ? add([id]) : setRows((prev) => prev.filter((r) => r.official_id !== id)));
  const patch = (id: number, p: Partial<Defaults>) => setRows((prev) => prev.map((r) => (r.official_id === id ? { ...r, ...p } : r)));

  const roleOf = (id: string) => roles.data?.find((r) => String(r.id) === id);
  const calc = (r: Row) => {
    const role = roleOf(r.role_id);
    const hours = parseDecimal(r.hours);
    const km = parseDecimal(r.kilometers);
    if (!role || hours == null || km == null) return null;
    return computeAssignment({
      role,
      hours,
      kilometers: km,
      travelRate: config.data?.travel_cost_per_km ?? 0,
      status: competition.status,
    });
  };
  const rowProblem = (r: Row) => {
    const h = parseDecimal(r.hours);
    const k = parseDecimal(r.kilometers);
    if (!roleOf(r.role_id)) return 'Izberite vlogo';
    if (h == null || h < 0 || h > 100) return 'Neveljavne ure';
    if (k == null || k < 0 || k > 10000) return 'Neveljavni kilometri';
    return null;
  };
  const problems = rows.filter((r) => rowProblem(r)).length;
  const totals = rows.reduce(
    (t, r) => {
      const c = calc(r);
      return c ? { sodnik: t.sodnik + c.totalSodnik, racun: t.racun + c.totalRacun } : t;
    },
    { sodnik: 0, racun: 0 },
  );

  const activeRoles = (roles.data ?? []).filter((r) => !r.archived);
  const activeDiscs = (disciplines.data ?? []).filter((d) => !d.archived);

  const submit = async () => {
    setError(null);
    try {
      const res = await bulk.mutateAsync({
        competition_id: competition.id,
        items: rows.map((r) => ({
          official_id: r.official_id,
          role_id: Number(r.role_id),
          discipline_id: r.discipline_id === NONE ? null : Number(r.discipline_id),
          hours: parseDecimal(r.hours)!,
          kilometers: parseDecimal(r.kilometers)!,
          notes: '',
        })),
      });
      if (res.skipped_official_ids.length > 0) {
        toast.warning(`Dodanih: ${res.added}. Preskočeni (že dodeljeni): ${res.skipped_official_ids.map(nameOf).join(', ')}`);
      } else {
        toast.success(res.added === 1 ? 'Dodan 1 sodnik' : `Dodanih sodnikov: ${res.added}`);
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dodajanje ni uspelo.');
    }
  };

  const defaultsControls = (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="w-44 space-y-1">
        <Label className="text-xs">Vloga</Label>
        <Select value={defaults.role_id} onValueChange={(v) => setDefaults((d) => ({ ...d, role_id: v }))}>
          <SelectTrigger className={roleSelect} aria-label="Privzeta vloga">
            <SelectValue placeholder="Izberite…" />
          </SelectTrigger>
          <SelectContent>
            {activeRoles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-44 space-y-1">
        <Label className="text-xs">Disciplina</Label>
        <Select value={defaults.discipline_id} onValueChange={(v) => setDefaults((d) => ({ ...d, discipline_id: v }))}>
          <SelectTrigger className={roleSelect} aria-label="Privzeta disciplina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Brez discipline</SelectItem>
            {activeDiscs.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-20 space-y-1">
        <Label className="text-xs">Ure</Label>
        <Input className="h-8 text-xs" inputMode="decimal" aria-label="Privzete ure" value={defaults.hours} onChange={(e) => setDefaults((d) => ({ ...d, hours: e.target.value }))} />
      </div>
      <div className="w-20 space-y-1">
        <Label className="text-xs">Km</Label>
        <Input className="h-8 text-xs" inputMode="decimal" aria-label="Privzeti kilometri" value={defaults.kilometers} onChange={(e) => setDefaults((d) => ({ ...d, kilometers: e.target.value }))} />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={rows.length === 0}
        onClick={() => setRows((prev) => prev.map((r) => ({ ...r, ...defaults })))}
      >
        Uporabi za vse vrstice
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col">
        <DialogHeader>
          <DialogTitle>Dodaj sodnike</DialogTitle>
          <DialogDescription>
            Izberite aktivne sodnike, ki še niso dodeljeni tekmovanju »{competition.name}«, in nastavite vlogo, ure ter kilometre. Privzete vrednosti
            veljajo za na novo izbrane sodnike.
          </DialogDescription>
        </DialogHeader>

        {defaultsControls}

        <div className="grid min-h-0 flex-1 grid-cols-[18rem_1fr] gap-4">
          <div className="flex min-h-0 flex-col rounded-lg border">
            <div className="relative border-b">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Išči sodnika…"
                aria-label="Išči sodnika"
                className="h-9 w-full bg-transparent pr-3 pl-9 text-sm outline-none"
              />
            </div>
            <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
              <span>
                Izbranih {rows.length} od {available.length}
              </span>
              <span className="flex gap-2">
                <button type="button" className="hover:text-foreground hover:underline" onClick={() => add(shown.map((o) => o.id))}>
                  Izberi vse
                </button>
                <button type="button" className="hover:text-foreground hover:underline" onClick={() => setRows([])}>
                  Počisti
                </button>
              </span>
            </div>
            <ul className="max-h-[22rem] min-h-40 flex-1 overflow-y-auto p-1">
              {available.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">Vsi aktivni sodniki so že dodeljeni.</li>
              )}
              {available.length > 0 && shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Ni zadetkov</li>}
              {shown.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                    <Checkbox checked={selected.has(o.id)} onCheckedChange={(c) => toggle(o.id, c === true)} />
                    <span className="flex-1 truncate">{o.name}</span>
                    {o.rank && <span className="text-xs text-muted-foreground">{o.rank}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-h-0 overflow-auto rounded-lg border">
            {rows.length === 0 ? (
              <p className="px-6 py-16 text-center text-sm text-muted-foreground">Izberite sodnike na levi.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-2 py-2">Sodnik</th>
                    <th className="px-2 py-2">Vloga</th>
                    <th className="px-2 py-2">Disciplina</th>
                    <th className="w-16 px-2 py-2">Ure</th>
                    <th className="w-16 px-2 py-2">Km</th>
                    <th className="px-2 py-2 text-right">Sodnik</th>
                    <th className="px-2 py-2 text-right">Račun</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = calc(r);
                    const problem = rowProblem(r);
                    return (
                      <tr key={r.official_id} className="border-t align-middle">
                        <td className="max-w-40 truncate px-2 py-1.5 font-medium">{nameOf(r.official_id)}</td>
                        <td className="px-2 py-1.5">
                          <Select value={r.role_id} onValueChange={(v) => patch(r.official_id, { role_id: v })}>
                            <SelectTrigger className={cn(roleSelect, 'w-36', !r.role_id && 'border-destructive')} aria-label="Vloga">
                              <SelectValue placeholder="Izberite…" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeRoles.map((role) => (
                                <SelectItem key={role.id} value={String(role.id)}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Select value={r.discipline_id} onValueChange={(v) => patch(r.official_id, { discipline_id: v })}>
                            <SelectTrigger className={cn(roleSelect, 'w-36')} aria-label="Disciplina">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Brez discipline</SelectItem>
                              {activeDiscs.map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 px-2 text-xs" inputMode="decimal" aria-label="Ure" value={r.hours} onChange={(e) => patch(r.official_id, { hours: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 px-2 text-xs" inputMode="decimal" aria-label="Kilometri" value={r.kilometers} onChange={(e) => patch(r.official_id, { kilometers: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{c ? formatCents(c.totalSodnik) : <span title={problem ?? ''}>–</span>}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{c ? formatCents(c.totalRacun) : <span title={problem ?? ''}>–</span>}</td>
                        <td className="px-1">
                          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Odstrani vrstico" onClick={() => toggle(r.official_id, false)}>
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-muted font-semibold">
                  <tr className="border-t">
                    <td className="px-2 py-2" colSpan={5}>
                      Skupaj ({rows.length})
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCents(totals.sodnik)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCents(totals.racun)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <DialogFooter className="items-center">
          {problems > 0 && <p className="mr-auto text-xs text-destructive">Pri {problems} vrsticah manjka vloga ali so podatki neveljavni.</p>}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Prekliči
          </Button>
          <Button type="button" disabled={rows.length === 0 || problems > 0 || bulk.isPending} onClick={() => void submit()}>
            {bulk.isPending ? 'Dodajam…' : rows.length === 0 ? 'Dodaj sodnike' : `Dodaj sodnike (${rows.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
