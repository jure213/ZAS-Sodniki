import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { FileDown, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatDate } from '@shared/dates';
import { STATUS_LABELS } from '@shared/labels';
import type { Competition } from '@shared/types';
import { useIsAdmin } from '@/auth/AuthContext';
import { CompetitionStatusBadge } from '@/components/badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { qk, useApiMutation } from '@/lib/api';
import { useCompetitions, useExcelExport } from '@/lib/hooks';
import { dash } from '@/lib/ui';
import { CompetitionSheet } from './CompetitionSheet';

export function CompetitionsPage() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const competitions = useCompetitions();

  const [editing, setEditing] = useState<{ competition?: Competition } | null>(null);
  const [deleting, setDeleting] = useState<Competition | null>(null);

  const del = useApiMutation('competitions:delete', {
    invalidate: [qk.competitions.all, qk.assignments.all, qk.dashboard.all],
    success: 'Tekmovanje izbrisano',
  });
  const exportXlsx = useExcelExport('excel:competitions');

  const columns = useMemo<ColumnDef<Competition>[]>(
    () => [
      { accessorKey: 'name', header: 'Tekmovanje', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
      {
        accessorKey: 'date',
        header: 'Datum',
        cell: (c) => formatDate(c.getValue<string>()),
        meta: { className: 'whitespace-nowrap' },
      },
      { accessorKey: 'location', header: 'Lokacija', cell: (c) => dash(c.getValue<string>()) },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <CompetitionStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { align: 'right', className: 'w-14' },
        cell: ({ row }) =>
          isAdmin ? (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Več dejanj">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing({ competition: row.original })}>
                    <Pencil /> Uredi
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => setDeleting(row.original)}>
                    <Trash2 /> Izbriši
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null,
      },
    ],
    [isAdmin],
  );

  return (
    <div>
      <PageHeader
        title="Tekmovanja"
        description="Tekmovanja, dodeljeni sodniki in izplačila"
        actions={
          <>
            <Button variant="excel" disabled={exportXlsx.isPending} onClick={() => exportXlsx.mutate(undefined)}>
              <FileDown /> Izvozi v Excel
            </Button>
            {isAdmin && (
              <Button onClick={() => setEditing({})}>
                <Plus /> Dodaj tekmovanje
              </Button>
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        data={competitions.data ?? []}
        loading={competitions.isLoading}
        error={competitions.error}
        onRetry={() => void competitions.refetch()}
        searchText={(c) => [c.name, c.location, c.notes, formatDate(c.date), c.status, STATUS_LABELS[c.status]].join(' ')}
        searchPlaceholder="Išči tekmovanje…"
        filters={[
          {
            id: 'status',
            label: 'Status',
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
        ]}
        initialSort={[{ id: 'date', desc: true }]}
        getRowId={(c) => String(c.id)}
        onRowClick={(c) => navigate(`/competitions/${c.id}`)}
        countLabel="tekmovanj"
        emptyTitle="Še ni tekmovanj"
        emptyDescription={isAdmin ? 'Dodajte prvo tekmovanje.' : undefined}
        emptyAction={
          isAdmin ? (
            <Button onClick={() => setEditing({})}>
              <Plus /> Dodaj tekmovanje
            </Button>
          ) : undefined
        }
      />

      <CompetitionSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        competition={editing?.competition}
        onSaved={(c) => !editing?.competition && navigate(`/competitions/${c.id}`)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Izbris tekmovanja"
        description={`Ali res želite izbrisati tekmovanje »${deleting?.name ?? ''}« skupaj z dodelitvami sodnikov? Tekmovanja z izplačili ni mogoče izbrisati.`}
        confirmLabel="Izbriši"
        destructive
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
      />
    </div>
  );
}
