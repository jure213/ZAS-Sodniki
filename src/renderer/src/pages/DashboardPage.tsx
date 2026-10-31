import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, CircleAlert, CircleCheck, Flag, Users } from 'lucide-react';
import type { OwedByOfficial } from '@shared/types';
import { formatCents } from '@shared/money';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardStats, useOwedByOfficial } from '@/lib/hooks';

const money = (c: number) => <span className="tabular-nums">{formatCents(c)}</span>;

export function DashboardPage() {
  const navigate = useNavigate();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const stats = useDashboardStats(year);
  const owed = useOwedByOfficial();

  const columns = useMemo<ColumnDef<OwedByOfficial>[]>(
    () => [
      { accessorKey: 'official_name', header: 'Sodnik', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
      {
        accessorKey: 'payments',
        header: 'Neporavnana izplačila',
        meta: { align: 'right', footer: (rows) => rows.reduce((s, r) => s + r.payments, 0) },
      },
      {
        accessorKey: 'owed_cents',
        header: 'Dolgovan znesek',
        cell: (c) => <span className="font-medium">{money(c.getValue<number>())}</span>,
        meta: { align: 'right', footer: (rows) => money(rows.reduce((s, r) => s + r.owed_cents, 0)) },
      },
      {
        id: 'go',
        header: '',
        enableSorting: false,
        cell: () => <ChevronRight className="ml-auto size-4 text-muted-foreground" />,
        meta: { className: 'w-10' },
      },
    ],
    [],
  );

  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);
  const s = stats.data;

  return (
    <div>
      <PageHeader title="Nadzorna plošča" description="Pregled izplačil sodnikom" />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sodniki" value={s?.total_officials} icon={Users} loading={stats.isLoading} hint="vsi vpisani sodniki" />
        <StatCard
          label="Aktivna tekmovanja"
          value={s?.active_competitions}
          icon={Flag}
          tone="pink"
          loading={stats.isLoading}
          hint="načrtovana in izvedena"
        />
        <StatCard
          label={`Plačano v letu ${year}`}
          value={s && money(s.paid_cents)}
          icon={CircleCheck}
          tone="green"
          loading={stats.isLoading}
          action={
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-7 w-[5.5rem] text-xs" aria-label="Leto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <StatCard
          label="Neplačano"
          value={s && money(s.owed_cents)}
          icon={CircleAlert}
          tone="red"
          loading={stats.isLoading}
          hint={s ? `Skupaj obveznosti: ${formatCents(s.total_cents)}` : undefined}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Neplačano po sodnikih</h2>
      <DataTable
        columns={columns}
        data={owed.data ?? []}
        loading={owed.isLoading}
        error={owed.error}
        onRetry={() => void owed.refetch()}
        searchText={(r) => r.official_name}
        searchPlaceholder="Poišči sodnika…"
        initialSort={[{ id: 'owed_cents', desc: true }]}
        onRowClick={(r) => navigate(`/payments?official=${r.official_id}`)}
        getRowId={(r) => String(r.official_id)}
        emptyTitle="Ni neplačanih izplačil"
        emptyDescription="Vsi sodniki so poplačani."
        countLabel="sodnikov"
        footerLabel="Skupaj"
      />
    </div>
  );
}
