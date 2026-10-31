// History of one official: every assignment with competition, date, role, amount and payment status.

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@shared/dates';
import { formatCents } from '@shared/money';
import type { Official, OfficialHistoryRow } from '@shared/types';
import { DataTable } from '@/components/DataTable';
import { PaymentStatusBadge } from '@/components/badges';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useOfficialHistory } from '@/lib/hooks';

const money = (c: number) => <span className="tabular-nums">{formatCents(c)}</span>;
const sum = (rows: OfficialHistoryRow[], f: (r: OfficialHistoryRow) => number) => rows.reduce((s, r) => s + f(r), 0);

export function OfficialHistorySheet({ official, onClose }: { official: Official | null; onClose: () => void }) {
  const history = useOfficialHistory(official?.id ?? null);

  const columns = useMemo<ColumnDef<OfficialHistoryRow>[]>(
    () => [
      { accessorKey: 'competition_date', header: 'Datum', cell: (c) => formatDate(c.getValue<string>()), meta: { className: 'whitespace-nowrap' } },
      { accessorKey: 'competition_name', header: 'Tekmovanje', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
      {
        id: 'role',
        header: 'Vloga',
        accessorFn: (r) => r.role_name,
        cell: ({ row }) => (
          <div>
            {row.original.role_name}
            {row.original.discipline_name && <div className="text-xs text-muted-foreground">{row.original.discipline_name}</div>}
          </div>
        ),
      },
      {
        id: 'hk',
        header: 'Ure / km',
        enableSorting: false,
        cell: ({ row }) => `${String(row.original.hours).replace('.', ',')} h / ${String(row.original.kilometers).replace('.', ',')} km`,
        meta: { className: 'whitespace-nowrap' },
      },
      {
        accessorKey: 'total_sodnik_cents',
        header: 'Sodnik',
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sum(rows, (r) => r.total_sodnik_cents)) },
      },
      {
        accessorKey: 'total_racun_cents',
        header: 'Račun',
        cell: (c) => money(c.getValue<number>()),
        meta: { align: 'right', footer: (rows) => money(sum(rows, (r) => r.total_racun_cents)) },
      },
      {
        id: 'payment',
        header: 'Izplačilo',
        accessorFn: (r) => r.payment?.status ?? '',
        cell: ({ row }) => <PaymentStatusBadge status={row.original.payment?.status} />,
      },
    ],
    [],
  );

  return (
    <Sheet open={!!official} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-4xl">
        <SheetHeader>
          <SheetTitle>Zgodovina sodnika</SheetTitle>
          <SheetDescription>{official?.name}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <DataTable
            columns={columns}
            data={history.data ?? []}
            loading={history.isLoading}
            error={history.error}
            onRetry={() => void history.refetch()}
            initialSort={[{ id: 'competition_date', desc: true }]}
            getRowId={(r) => String(r.assignment_id)}
            emptyTitle="Sodnik še ni bil dodeljen nobenemu tekmovanju"
            countLabel="dodelitev"
            maxHeightClass="max-h-[calc(100vh-14rem)]"
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
