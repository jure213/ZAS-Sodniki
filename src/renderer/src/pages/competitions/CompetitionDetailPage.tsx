// Competition detail: header, assignments (with live-calculated edit sheet and bulk add)
// and the payments section (preview for the chosen tariff, Excel preview, generate).

import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, CalendarDays, FileDown, HandCoins, MapPin, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { formatDate } from '@shared/dates';
import { formatCents } from '@shared/money';
import { TARIFF_LABELS } from '@shared/labels';
import type { Tariff } from '@shared/tariff';
import type { Assignment } from '@shared/types';
import { toast } from 'sonner';
import { useIsAdmin } from '@/auth/AuthContext';
import { CompetitionStatusBadge, PaymentStatusBadge } from '@/components/badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { ErrorState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hint } from '@/components/ui/tooltip';
import { qk, useApiMutation } from '@/lib/api';
import { useAssignments, useCompetition, useExcelExport } from '@/lib/hooks';
import { dash, money, num, sumBy } from '@/lib/ui';
import { AssignmentSheet } from './AssignmentSheet';
import { BulkAddDialog } from './BulkAddDialog';
import { CompetitionSheet } from './CompetitionSheet';

const amounts = (a: Assignment, t: Tariff) =>
  t === 'sodnik'
    ? { base: a.base_sodnik_cents, total: a.total_sodnik_cents }
    : { base: a.base_racun_cents, total: a.total_racun_cents };

export function CompetitionDetailPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const isAdmin = useIsAdmin();

  const competition = useCompetition(id);
  const assignments = useAssignments(id);
  const list = useMemo(() => assignments.data ?? [], [assignments.data]);

  const [tariff, setTariff] = useState<Tariff>('sodnik');
  const [editingComp, setEditingComp] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [bulk, setBulk] = useState(false);
  const [deleting, setDeleting] = useState<Assignment | null>(null);
  const [recalc, setRecalc] = useState(false);
  const [generating, setGenerating] = useState(false);

  const delAssignment = useApiMutation('assignments:delete', {
    invalidate: [qk.assignments.all, qk.officials.all],
    success: 'Dodelitev odstranjena',
  });
  const recalculate = useApiMutation('assignments:recalculate', {
    invalidate: [qk.assignments.all],
    success: (r) => (r.updated === 1 ? 'Preračunana 1 dodelitev' : `Preračunanih dodelitev: ${r.updated}`),
  });
  const generate = useApiMutation('payments:generate', {
    invalidate: [qk.assignments.all, qk.payments.all, qk.dashboard.all, qk.officials.all],
    onSuccess: (r) => {
      const parts = [`ustvarjenih: ${r.created}`];
      if (r.skipped_existing) parts.push(`že obstaja: ${r.skipped_existing}`);
      if (r.skipped_zero) parts.push(`preskočenih (0 €): ${r.skipped_zero}`);
      (r.created > 0 ? toast.success : toast.info)(`Izplačila – ${parts.join(', ')}`);
    },
  });
  const exportPreview = useExcelExport('excel:preview');

  const c = competition.data;

  const columns = useMemo<ColumnDef<Assignment>[]>(
    () => [
      {
        accessorKey: 'official_name',
        header: 'Sodnik',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.official_name}</div>
            {row.original.official_rank && <div className="text-xs text-muted-foreground">{row.original.official_rank}</div>}
          </div>
        ),
      },
      {
        accessorKey: 'role_name',
        header: 'Vloga',
        cell: ({ row }) => (
          <div>
            {row.original.role_name}
            {row.original.role_archived && <span className="text-xs text-muted-foreground"> (arhivirana)</span>}
            {row.original.discipline_name && <div className="text-xs text-muted-foreground">{row.original.discipline_name}</div>}
          </div>
        ),
      },
      { accessorKey: 'hours', header: 'Ure', cell: (c) => num(c.getValue<number>()), meta: { align: 'right' } },
      { accessorKey: 'kilometers', header: 'Km', cell: (c) => num(c.getValue<number>()), meta: { align: 'right' } },
      {
        id: 'base',
        header: 'Osnova',
        accessorFn: (a) => amounts(a, tariff).base,
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (a) => amounts(a, tariff).base)) },
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
        accessorFn: (a) => amounts(a, tariff).total,
        cell: (c) => <span className="font-medium">{money(c.getValue<number>())}</span>,
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (a) => amounts(a, tariff).total)) },
      },
      {
        id: 'payment',
        header: 'Izplačilo',
        accessorFn: (a) => a.payment?.status ?? '',
        cell: ({ row }) => <PaymentStatusBadge status={row.original.payment?.status} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { align: 'right', className: 'w-12' },
        cell: ({ row }) =>
          isAdmin ? (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" aria-label="Več dejanj">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                    <Pencil /> Uredi
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => setDeleting(row.original)}>
                    <Trash2 /> Odstrani
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null,
      },
    ],
    [isAdmin, tariff],
  );

  const previewColumns = useMemo<ColumnDef<Assignment>[]>(
    () => [
      { accessorKey: 'official_name', header: 'Sodnik', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
      { accessorKey: 'role_name', header: 'Vloga', cell: ({ row }) => dash(row.original.role_name) },
      {
        id: 'base',
        header: 'Osnova',
        accessorFn: (a) => amounts(a, tariff).base,
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (a) => amounts(a, tariff).base)) },
      },
      {
        accessorKey: 'travel_cents',
        header: 'Potni stroški',
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (a) => a.travel_cents)) },
      },
      {
        id: 'total',
        header: 'Za izplačilo',
        accessorFn: (a) => amounts(a, tariff).total,
        cell: (c) => <span className="font-medium">{money(c.getValue<number>())}</span>,
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (a) => amounts(a, tariff).total)) },
      },
      {
        id: 'payment',
        header: 'Stanje',
        accessorFn: (a) => a.payment?.status ?? '',
        cell: ({ row }) => {
          const a = row.original;
          if (a.payment) return <PaymentStatusBadge status={a.payment.status} />;
          return amounts(a, tariff).total === 0 ? (
            <span className="text-xs text-muted-foreground">Preskočeno (0 €)</span>
          ) : (
            <span className="text-xs text-muted-foreground">Bo ustvarjeno</span>
          );
        },
      },
    ],
    [tariff],
  );

  if (!Number.isInteger(id) || id <= 0) return <Navigate to="/competitions" replace />;
  if (competition.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }
  if (competition.error || !c) {
    return (
      <div>
        <BackLink />
        <div className="rounded-xl border bg-card">
          <ErrorState error={competition.error ?? new Error('Tekmovanje ne obstaja.')} onRetry={() => void competition.refetch()} />
        </div>
      </div>
    );
  }

  const blocked = c.status === 'planned' || c.status === 'cancelled';
  const toCreate = list.filter((a) => !a.payment && amounts(a, tariff).total > 0);
  const existing = list.filter((a) => a.payment);
  const zero = list.filter((a) => !a.payment && amounts(a, tariff).total === 0);
  const withoutPayment = list.filter((a) => !a.payment).length;

  const generateDisabledReason = blocked
    ? `Izplačil ni mogoče ustvariti, ker je tekmovanje »${c.status === 'planned' ? 'Načrtovano' : 'Preklicano'}«. Najprej spremenite status v »Izvedeno«.`
    : list.length === 0
      ? 'Tekmovanju še ni dodeljen noben sodnik.'
      : toCreate.length === 0
        ? 'Ni novih izplačil za ustvariti (vsi sodniki imajo izplačilo ali znesek 0 €).'
        : null;

  return (
    <div>
      <BackLink />
      <PageHeader
        title={c.name}
        description={undefined}
        actions={
          isAdmin && (
            <Button variant="outline" onClick={() => setEditingComp(true)}>
              <Pencil /> Uredi tekmovanje
            </Button>
          )
        }
      />
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" /> {formatDate(c.date)}
        </span>
        {c.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" /> {c.location}
          </span>
        )}
        <CompetitionStatusBadge status={c.status} />
        {c.notes && <span className="max-w-xl truncate" title={c.notes}>{c.notes}</span>}
      </div>

      {(c.status === 'free' || c.status === 'other_zas') && (
        <p className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Status »{c.status === 'free' ? 'Zastonj' : 'Plača drug ZAS'}« – vsi zneski, vključno s potnimi stroški, so 0 €.
        </p>
      )}

      <Tabs defaultValue="assignments">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="assignments">Dodeljeni sodniki ({list.length})</TabsTrigger>
            <TabsTrigger value="payments">Izplačila</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tarifa</span>
            <Select value={tariff} onValueChange={(v) => setTariff(v as Tariff)}>
              <SelectTrigger className="w-32 bg-card" aria-label="Tarifa">
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
        </div>

        <TabsContent value="assignments">
          <DataTable
            columns={columns}
            data={list}
            loading={assignments.isLoading}
            error={assignments.error}
            onRetry={() => void assignments.refetch()}
            searchText={(a) => [a.official_name, a.official_rank, a.role_name, a.discipline_name ?? ''].join(' ')}
            searchPlaceholder="Išči med dodeljenimi…"
            toolbar={
              isAdmin && (
                <>
                  <Hint label="Preračuna zneske dodelitev brez izplačila po trenutni tarifi (npr. po spremembi statusa)">
                    <Button variant="outline" disabled={withoutPayment === 0} onClick={() => setRecalc(true)}>
                      <RefreshCw /> Preračunaj zneske
                    </Button>
                  </Hint>
                  <Button onClick={() => setBulk(true)}>
                    <UserPlus /> Dodaj sodnike
                  </Button>
                </>
              )
            }
            initialSort={[{ id: 'official_name', desc: false }]}
            getRowId={(a) => String(a.id)}
            onRowClick={isAdmin ? (a) => setEditing(a) : undefined}
            countLabel="dodelitev"
            emptyTitle="Tekmovanju še ni dodeljen noben sodnik"
            emptyDescription={isAdmin ? 'Dodajte sodnike, da bo mogoče pripraviti izplačila.' : undefined}
            emptyAction={
              isAdmin ? (
                <Button onClick={() => setBulk(true)}>
                  <Plus /> Dodaj sodnike
                </Button>
              ) : undefined
            }
          />
        </TabsContent>

        <TabsContent value="payments">
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="mr-auto text-sm">
              <p className="font-medium">Predogled izplačil – tarifa »{TARIFF_LABELS[tariff]}«</p>
              <p className="text-muted-foreground">
                Za ustvarjanje: <b className="text-foreground">{toCreate.length}</b> · že obstaja: <b className="text-foreground">{existing.length}</b> ·
                preskočeno (0 €): <b className="text-foreground">{zero.length}</b>
              </p>
            </div>
            {existing.length > 0 && (
              <Button variant="outline" asChild>
                <Link to={`/payments?competition=${c.id}`}>
                  <HandCoins /> Odpri izplačila
                </Link>
              </Button>
            )}
            <Button
              variant="excel"
              disabled={list.length === 0 || exportPreview.isPending}
              onClick={() => exportPreview.mutate({ competition_id: c.id, tariff })}
            >
              <FileDown /> Izvozi predogled v Excel
            </Button>
            {isAdmin && (
              <Hint label={generateDisabledReason ?? 'Ustvari izplačila za dodeljene sodnike'}>
                {/* span keeps the tooltip working on a disabled button */}
                <span>
                  <Button disabled={!!generateDisabledReason || generate.isPending} onClick={() => setGenerating(true)}>
                    <HandCoins /> Generiraj izplačila
                  </Button>
                </span>
              </Hint>
            )}
          </div>
          {isAdmin && generateDisabledReason && <p className="mb-3 px-1 text-sm text-muted-foreground">{generateDisabledReason}</p>}
          <DataTable
            columns={previewColumns}
            data={list}
            loading={assignments.isLoading}
            error={assignments.error}
            onRetry={() => void assignments.refetch()}
            initialSort={[{ id: 'official_name', desc: false }]}
            getRowId={(a) => String(a.id)}
            countLabel="dodelitev"
            emptyTitle="Ni dodeljenih sodnikov"
            maxHeightClass="max-h-[calc(100vh-24rem)]"
          />
        </TabsContent>
      </Tabs>

      <CompetitionSheet open={editingComp} onOpenChange={setEditingComp} competition={c} />
      <AssignmentSheet competition={c} assignment={editing} onClose={() => setEditing(null)} />
      <BulkAddDialog open={bulk} onOpenChange={setBulk} competition={c} assignments={list} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Odstranitev dodelitve"
        description={
          deleting?.payment
            ? `Sodnik »${deleting.official_name}« ima izplačilo, zato dodelitve ni mogoče odstraniti. Najprej izbrišite izplačilo.`
            : `Ali res želite odstraniti sodnika »${deleting?.official_name ?? ''}« s tekmovanja?`
        }
        confirmLabel="Odstrani"
        destructive
        onConfirm={() => deleting && delAssignment.mutate({ id: deleting.id })}
      />
      <ConfirmDialog
        open={recalc}
        onOpenChange={setRecalc}
        title="Preračun zneskov"
        description={`Zneski ${withoutPayment === 1 ? 'ene dodelitve' : `${withoutPayment} dodelitev`} brez izplačila se bodo preračunali po trenutni tarifi, statusu tekmovanja in ceni na kilometer. Ročno vnesene osnove bodo prepisane. Dodelitve z izplačilom ostanejo nespremenjene.`}
        confirmLabel="Preračunaj"
        onConfirm={() => recalculate.mutate({ competition_id: c.id })}
      />
      <ConfirmDialog
        open={generating}
        onOpenChange={setGenerating}
        title="Generiranje izplačil"
        description={`Tarifa »${TARIFF_LABELS[tariff]}«: ustvarjenih bo ${toCreate.length} izplačil v skupni vrednosti ${formatCents(
          sumBy(toCreate, (a) => amounts(a, tariff).total),
        )}. Preskočenih bo ${existing.length} že ustvarjenih in ${zero.length} z zneskom 0 €.`}
        confirmLabel="Generiraj"
        onConfirm={() => generate.mutate({ competition_id: c.id, tariff })}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/competitions" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Vsa tekmovanja
    </Link>
  );
}
