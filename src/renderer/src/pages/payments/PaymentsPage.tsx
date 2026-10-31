import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { FileDown, X } from 'lucide-react';
import { formatDate } from '@shared/dates';
import { STATUS_LABELS } from '@shared/labels';
import type { PaymentFilter } from '@shared/schemas';
import type { PaymentRow, PaymentStatus } from '@shared/types';
import { PaymentStatusBadge } from '@/components/badges';
import { Combobox } from '@/components/Combobox';
import { DataTable } from '@/components/DataTable';
import { DateField } from '@/components/DateField';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCompetitions, useExcelExport, useOfficials, usePayments } from '@/lib/hooks';
import { dash, money, sumBy } from '@/lib/ui';
import { PaymentSheet } from './PaymentSheet';

const ALL = '__all__';
const STATUS_FILTER: { value: string; label: string }[] = [
  { value: 'open', label: 'Odprta (neplačana + delno)' },
  { value: 'owed', label: 'Neplačana' },
  { value: 'partial', label: 'Delno plačana' },
  { value: 'paid', label: 'Plačana' },
];

const positiveInt = (s: string | null) => (s && /^\d+$/.test(s) && Number(s) > 0 ? s : null);
const validIso = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export function PaymentsPage() {
  const [params, setParams] = useSearchParams();
  const officials = useOfficials();
  const competitions = useCompetitions();

  const official = positiveInt(params.get('official'));
  const competition = positiveInt(params.get('competition'));
  const setParam = (key: 'official' | 'competition', value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const [status, setStatus] = useState<string>(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const filter = useMemo<PaymentFilter>(
    () => ({
      ...(official ? { official_id: Number(official) } : {}),
      ...(competition ? { competition_id: Number(competition) } : {}),
      ...(status !== ALL ? { status: status as PaymentStatus | 'open' } : {}),
      ...(validIso(from) ? { date_from: validIso(from) } : {}),
      ...(validIso(to) ? { date_to: validIso(to) } : {}),
      hide_zero: hideZero,
    }),
    [official, competition, status, from, to, hideZero],
  );
  const payments = usePayments(filter);
  const exportXlsx = useExcelExport('excel:payments');

  const dirtyFilters = !!official || !!competition || status !== ALL || from !== '' || to !== '' || !hideZero;
  const reset = () => {
    setParams({}, { replace: true });
    setStatus(ALL);
    setFrom('');
    setTo('');
    setHideZero(true);
  };

  const officialOptions = useMemo(
    () => [{ value: '', label: 'Vsi sodniki' }, ...(officials.data ?? []).map((o) => ({ value: String(o.id), label: o.name, hint: o.active ? undefined : 'neaktiven' })).sort((a, b) => a.label.localeCompare(b.label, 'sl'))],
    [officials.data],
  );
  const competitionOptions = useMemo(
    () =>
      [...(competitions.data ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((c) => ({ value: String(c.id), label: c.name, hint: formatDate(c.date) }))
        .reduce<{ value: string; label: string; hint?: string }[]>((acc, o) => (acc.push(o), acc), [{ value: '', label: 'Vsa tekmovanja' }]),
    [competitions.data],
  );

  const columns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      { accessorKey: 'official_name', header: 'Sodnik', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
      { accessorKey: 'competition_name', header: 'Tekmovanje' },
      {
        accessorKey: 'competition_date',
        header: 'Datum tekme',
        cell: (c) => formatDate(c.getValue<string>()),
        meta: { className: 'whitespace-nowrap' },
      },
      {
        accessorKey: 'amount_due_cents',
        header: 'Za izplačilo',
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (r) => r.amount_due_cents)) },
      },
      {
        accessorKey: 'paid_cents',
        header: 'Plačano',
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (r) => r.paid_cents)) },
      },
      {
        accessorKey: 'remaining_cents',
        header: 'Preostanek',
        cell: ({ row }) => (
          <span className={row.original.remaining_cents > 0 ? 'font-medium text-red-700' : ''}>{money(row.original.remaining_cents)}</span>
        ),
        meta: { align: 'right', footer: (rows) => money(sumBy(rows, (r) => r.remaining_cents)) },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'last_paid_on',
        header: 'Zadnje plačilo',
        cell: (c) => (c.getValue<string | null>() ? formatDate(c.getValue<string>()) : dash('')),
        meta: { className: 'whitespace-nowrap' },
      },
    ],
    [],
  );

  const officialName = official ? officials.data?.find((o) => String(o.id) === official)?.name : undefined;

  return (
    <div>
      <PageHeader
        title="Izplačila"
        description={officialName ? `Izplačila sodnika ${officialName}` : 'Pregled izplačil in plačil po sodnikih ter tekmovanjih'}
        actions={
          <Button variant="outline" disabled={exportXlsx.isPending || (payments.data?.length ?? 0) === 0} onClick={() => exportXlsx.mutate(filter)}>
            <FileDown /> Izvozi v Excel
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="w-56 space-y-1">
          <Label className="text-xs">Sodnik</Label>
          <Combobox value={official} onChange={(v) => setParam('official', v)} options={officialOptions} placeholder="Vsi sodniki" searchPlaceholder="Išči sodnika…" />
        </div>
        <div className="w-64 space-y-1">
          <Label className="text-xs">Tekmovanje</Label>
          <Combobox value={competition} onChange={(v) => setParam('competition', v)} options={competitionOptions} placeholder="Vsa tekmovanja" searchPlaceholder="Išči tekmovanje…" />
        </div>
        <div className="w-52 space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status izplačila">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Vsi statusi</SelectItem>
              {STATUS_FILTER.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36 space-y-1">
          <Label className="text-xs" htmlFor="f-from">
            Tekma od
          </Label>
          <DateField id="f-from" value={from} onChange={setFrom} />
        </div>
        <div className="w-36 space-y-1">
          <Label className="text-xs" htmlFor="f-to">
            Tekma do
          </Label>
          <DateField id="f-to" value={to} onChange={setTo} />
        </div>
        <div className="flex h-9 items-center gap-2">
          <Switch id="f-zero" checked={hideZero} onCheckedChange={setHideZero} />
          <Label htmlFor="f-zero" className="text-sm font-normal">
            Skrij izplačila z 0 €
          </Label>
        </div>
        {dirtyFilters && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X /> Ponastavi filtre
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={payments.data ?? []}
        loading={payments.isLoading}
        error={payments.error}
        onRetry={() => void payments.refetch()}
        searchText={(r) => [r.official_name, r.competition_name, formatDate(r.competition_date), STATUS_LABELS[r.competition_status]].join(' ')}
        searchPlaceholder="Išči po izplačilih…"
        initialSort={[{ id: 'competition_date', desc: true }]}
        getRowId={(r) => String(r.id)}
        onRowClick={(r) => setOpenId(r.id)}
        countLabel="izplačil"
        emptyTitle="Ni izplačil"
        emptyDescription={
          dirtyFilters ? 'Za izbrane filtre ni izplačil. Poskusite jih ponastaviti.' : 'Izplačila nastanejo, ko na strani tekmovanja izberete »Generiraj izplačila«.'
        }
        emptyAction={
          dirtyFilters ? (
            <Button variant="outline" onClick={reset}>
              Ponastavi filtre
            </Button>
          ) : undefined
        }
        maxHeightClass="max-h-[calc(100vh-22rem)]"
      />

      <PaymentSheet paymentId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
