// Izpisi: on-screen previews of the Excel reports, then the export itself.
//   D1 Sodniki po tekmi, D2 Pregled tekem, D5 Seznam tekmovanj.

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { FileDown, Search } from 'lucide-react';
import { formatDate } from '@shared/dates';
import { TARIFF_LABELS } from '@shared/labels';
import type { Tariff } from '@shared/tariff';
import type { Assignment, CompetitionSummaryRow } from '@shared/types';
import { Combobox } from '@/components/Combobox';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiQuery } from '@/lib/api';
import { useAssignments, useCompetitions, useExcelExport } from '@/lib/hooks';
import { normalize } from '@/lib/text';
import { dash, money, num, sumBy } from '@/lib/ui';

function TariffSelect({ value, onChange }: { value: Tariff; onChange: (t: Tariff) => void }) {
  return (
    <div className="w-36 space-y-1">
      <Label className="text-xs">Tarifa</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Tariff)}>
        <SelectTrigger aria-label="Tarifa">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TARIFF_LABELS).map(([k, l]) => (
            <SelectItem key={k} value={k}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const pick = (a: Assignment, t: Tariff) =>
  t === 'sodnik' ? { base: a.base_sodnik_cents, total: a.total_sodnik_cents } : { base: a.base_racun_cents, total: a.total_racun_cents };

// --- D1 ---------------------------------------------------------------------

function CompetitionReport() {
  const competitions = useCompetitions();
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [tariff, setTariff] = useState<Tariff>('sodnik');
  const id = competitionId ? Number(competitionId) : 0;
  const assignments = useAssignments(id);
  const exportXlsx = useExcelExport('excel:competitionReport');

  const options = useMemo(
    () =>
      [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)).map((c) => ({ value: String(c.id), label: c.name, hint: formatDate(c.date) })),
    [competitions.data],
  );

  const columns = useMemo<ColumnDef<Assignment>[]>(
    () => [
      { accessorKey: 'official_name', header: 'Ime', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
      { accessorKey: 'official_rank', header: 'Rang', cell: (c) => dash(c.getValue<string>()) },
      { accessorKey: 'role_name', header: 'Vloga' },
      { accessorKey: 'discipline_name', header: 'Disciplina', cell: (c) => dash(c.getValue<string | null>()) },
      { accessorKey: 'hours', header: 'Ure', cell: (c) => num(c.getValue<number>()), meta: { align: 'right' } },
      {
        id: 'base',
        header: 'Znesek',
        accessorFn: (a) => pick(a, tariff).base,
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (a) => pick(a, tariff).base)) },
      },
      {
        accessorKey: 'travel_cents',
        header: 'Potni stroški',
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (a) => a.travel_cents)) },
      },
      {
        id: 'total',
        header: 'Skupaj',
        accessorFn: (a) => pick(a, tariff).total,
        cell: (c) => <span className="font-medium">{money(c.getValue<number>())}</span>,
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (a) => pick(a, tariff).total)) },
      },
    ],
    [tariff],
  );

  const rows = assignments.data ?? [];
  const noData = !competitionId || (!assignments.isLoading && rows.length === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="w-80 space-y-1">
          <Label className="text-xs">Tekmovanje</Label>
          <Combobox value={competitionId} onChange={setCompetitionId} options={options} placeholder="Izberite tekmovanje…" searchPlaceholder="Išči tekmovanje…" />
        </div>
        <TariffSelect value={tariff} onChange={setTariff} />
        <div className="ml-auto flex items-center gap-3">
          {noData && (
            <span className="text-xs text-muted-foreground">
              {!competitionId ? 'Izberite tekmovanje za predogled.' : 'Izbrano tekmovanje nima dodeljenih sodnikov.'}
            </span>
          )}
          <Button variant="excel" disabled={noData || exportXlsx.isPending} onClick={() => exportXlsx.mutate({ competition_id: id, tariff })}>
            <FileDown /> Izvozi v Excel
          </Button>
        </div>
      </div>
      {competitionId ? (
        <DataTable
          columns={columns}
          data={rows}
          loading={assignments.isLoading}
          error={assignments.error}
          onRetry={() => void assignments.refetch()}
          initialSort={[{ id: 'official_name', desc: false }]}
          getRowId={(a) => String(a.id)}
          countLabel="sodnikov"
          emptyTitle="Ni dodeljenih sodnikov"
          maxHeightClass="max-h-[calc(100vh-22rem)]"
        />
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">Izberite tekmovanje, da vidite predogled poročila.</div>
      )}
    </div>
  );
}

// --- D2 ---------------------------------------------------------------------

function SummaryReport() {
  const competitions = useCompetitions();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tariff, setTariff] = useState<Tariff>('sodnik');
  const [search, setSearch] = useState('');
  const exportXlsx = useExcelExport('excel:summary');

  const sorted = useMemo(() => [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [competitions.data]);
  const shown = useMemo(() => {
    const n = normalize(search).trim();
    return n ? sorted.filter((c) => normalize(`${c.name} ${c.location} ${formatDate(c.date)}`).includes(n)) : sorted;
  }, [sorted, search]);

  const ids = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const summary = useApiQuery('excel:summaryData', { competition_ids: ids, tariff }, ['exports', 'summary', tariff, ids] as const, {
    enabled: ids.length > 0,
    placeholderData: (prev) => prev,
  });

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const columns = useMemo<ColumnDef<CompetitionSummaryRow>[]>(
    () => [
      { accessorKey: 'name', header: 'Tekmovanje', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
      { accessorKey: 'date', header: 'Datum', cell: (c) => formatDate(c.getValue<string>()), meta: { className: 'whitespace-nowrap' } },
      { accessorKey: 'location', header: 'Lokacija', cell: (c) => dash(c.getValue<string>()) },
      {
        accessorKey: 'officials_cents',
        header: 'Sodniki',
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (r) => r.officials_cents)) },
      },
      {
        accessorKey: 'travel_cents',
        header: 'Potni stroški',
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (r) => r.travel_cents)) },
      },
      {
        accessorKey: 'total_cents',
        header: 'Skupaj',
        cell: (c) => <span className="font-medium">{money(c.getValue<number>())}</span>,
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (r) => r.total_cents)) },
      },
    ],
    [],
  );

  const rows = ids.length > 0 ? (summary.data ?? []) : [];
  const noData = ids.length === 0 || (!summary.isLoading && rows.length === 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="flex flex-col rounded-xl border bg-card shadow-sm">
          <div className="relative border-b">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Išči tekmovanje…"
              aria-label="Išči tekmovanje"
              className="h-10 w-full bg-transparent pr-3 pl-9 text-sm outline-none"
            />
          </div>
          <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
            <span>
              Izbranih {selected.size} od {sorted.length}
            </span>
            <span className="flex gap-3">
              <button type="button" className="hover:text-foreground hover:underline" onClick={() => setSelected((p) => new Set([...p, ...shown.map((c) => c.id)]))}>
                Izberi vse
              </button>
              <button type="button" className="hover:text-foreground hover:underline" onClick={() => setSelected(new Set())}>
                Počisti
              </button>
            </span>
          </div>
          <ul className="max-h-[calc(100vh-26rem)] min-h-48 overflow-y-auto p-1">
            {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Ni zadetkov</li>}
            {shown.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                  <Checkbox className="mt-0.5" checked={selected.has(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} />
                  <span className="flex-1">
                    <span className="block leading-snug">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(c.date)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <TariffSelect value={tariff} onChange={setTariff} />
            <div className="ml-auto flex items-center gap-3">
              {noData && (
                <span className="text-xs text-muted-foreground">
                  {ids.length === 0 ? 'Izberite vsaj eno tekmovanje.' : 'Za izbrana tekmovanja ni podatkov.'}
                </span>
              )}
              <Button variant="excel" disabled={noData || exportXlsx.isPending} onClick={() => exportXlsx.mutate({ competition_ids: ids, tariff })}>
                <FileDown /> Izvozi v Excel
              </Button>
            </div>
          </div>
          {ids.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">Izberite tekmovanja na levi, da vidite predogled.</div>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              loading={summary.isLoading}
              error={summary.error}
              onRetry={() => void summary.refetch()}
              initialSort={[{ id: 'date', desc: true }]}
              getRowId={(r) => String(r.id)}
              countLabel="tekmovanj"
              emptyTitle="Ni podatkov"
              maxHeightClass="max-h-[calc(100vh-26rem)]"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- D5 ---------------------------------------------------------------------

function CompetitionsList() {
  const competitions = useCompetitions();
  const exportXlsx = useExcelExport('excel:competitions');
  const count = competitions.data?.length ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="mr-auto">
        <p className="font-medium">Seznam vseh tekmovanj</p>
        <p className="text-sm text-muted-foreground">Ime, datum, lokacija in status vseh tekmovanj ({count}).</p>
      </div>
      <Button variant="excel" disabled={count === 0 || exportXlsx.isPending} onClick={() => exportXlsx.mutate(undefined)}>
        <FileDown /> Izvozi v Excel
      </Button>
      {count === 0 && <span className="text-xs text-muted-foreground">Ni tekmovanj za izvoz.</span>}
    </div>
  );
}

export function ExportsPage() {
  return (
    <div>
      <PageHeader title="Izpisi" description="Predogled in izvoz poročil v Excel" />
      <Tabs defaultValue="by-competition">
        <TabsList className="mb-4">
          <TabsTrigger value="by-competition">Sodniki po tekmi</TabsTrigger>
          <TabsTrigger value="summary">Pregled tekem</TabsTrigger>
          <TabsTrigger value="list">Seznam tekmovanj</TabsTrigger>
        </TabsList>
        <TabsContent value="by-competition">
          <CompetitionReport />
        </TabsContent>
        <TabsContent value="summary">
          <SummaryReport />
        </TabsContent>
        <TabsContent value="list">
          <CompetitionsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
