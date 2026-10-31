import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { FileDown, FileUp, History, MoreHorizontal, Pencil, Plus, Power, Trash2, UserCheck } from 'lucide-react';
import type { ImportPreview, Official } from '@shared/types';
import { useIsAdmin } from '@/auth/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Hint } from '@/components/ui/tooltip';
import { qk, useApiMutation } from '@/lib/api';
import { useExcelExport, useOfficials } from '@/lib/hooks';
import { ImportDialog } from './ImportDialog';
import { OfficialHistorySheet } from './OfficialHistorySheet';
import { OfficialSheet } from './OfficialSheet';

const dash = (v: string) => v || <span className="text-muted-foreground/60">–</span>;

export function OfficialsPage() {
  const isAdmin = useIsAdmin();
  const officials = useOfficials();

  const [editing, setEditing] = useState<{ official?: Official } | null>(null);
  const [history, setHistory] = useState<Official | null>(null);
  const [deleting, setDeleting] = useState<Official | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const invalidate = [qk.officials.all, qk.dashboard.all];
  const setActive = useApiMutation('officials:setActive', { invalidate });
  const del = useApiMutation('officials:delete', { invalidate, success: 'Sodnik izbrisan' });
  const exportXlsx = useExcelExport('excel:officials');
  const importPreview = useApiMutation('officials:importPreview', {
    onSuccess: (p) => {
      if (p) setPreview(p);
    },
  });

  const rankOptions = useMemo(
    () =>
      [...new Set((officials.data ?? []).map((o) => o.rank).filter(Boolean))].sort().map((r) => ({ value: r, label: r })),
    [officials.data],
  );

  const columns = useMemo<ColumnDef<Official>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Ime in priimek',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium">{row.original.name}</div>
            {row.original.notes && (
              <div className="max-w-xs truncate text-xs text-muted-foreground" title={row.original.notes}>
                {row.original.notes}
              </div>
            )}
          </div>
        ),
      },
      { accessorKey: 'rank', header: 'Rang', cell: (c) => dash(c.getValue<string>()) },
      { accessorKey: 'email', header: 'E-pošta', cell: (c) => dash(c.getValue<string>()) },
      { accessorKey: 'phone', header: 'Telefon', cell: (c) => dash(c.getValue<string>()), meta: { className: 'whitespace-nowrap' } },
      {
        accessorKey: 'additional_exams',
        header: 'Dodatni izpiti',
        cell: (c) => <span className="line-clamp-2 max-w-48">{dash(c.getValue<string>())}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (o) => (o.active ? 'active' : 'inactive'),
        cell: ({ row }) =>
          row.original.active ? <Badge variant="success">Aktiven</Badge> : <Badge variant="secondary">Neaktiven</Badge>,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { align: 'right', className: 'w-24' },
        cell: ({ row }) => {
          const o = row.original;
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Hint label="Zgodovina">
                <Button variant="ghost" size="icon" className="size-8" aria-label="Zgodovina" onClick={() => setHistory(o)}>
                  <History />
                </Button>
              </Hint>
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Več dejanj">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing({ official: o })}>
                      <Pencil /> Uredi
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActive.mutate({ id: o.id, active: !o.active })}>
                      {o.active ? <Power /> : <UserCheck />}
                      {o.active ? 'Deaktiviraj' : 'Aktiviraj'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleting(o)}>
                      <Trash2 /> Izbriši
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin],
  );

  return (
    <div>
      <PageHeader
        title="Sodniki"
        description="Seznam sodnikov in njihova zgodovina"
        actions={
          isAdmin && (
            <>
              <Button variant="excel" disabled={exportXlsx.isPending} onClick={() => exportXlsx.mutate(undefined)}>
                <FileDown /> Izvozi v Excel
              </Button>
              <Button variant="excel" disabled={importPreview.isPending} onClick={() => importPreview.mutate(undefined)}>
                <FileUp /> Uvozi iz Excela
              </Button>
              <Button onClick={() => setEditing({})}>
                <Plus /> Dodaj sodnika
              </Button>
            </>
          )
        }
      />

      <DataTable
        columns={columns}
        data={officials.data ?? []}
        loading={officials.isLoading}
        error={officials.error}
        onRetry={() => void officials.refetch()}
        searchText={(o) => [o.name, o.email, o.phone, o.rank, o.additional_exams, o.notes].join(' ')}
        searchPlaceholder="Išči sodnika…"
        filters={[
          {
            id: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Aktivni' },
              { value: 'inactive', label: 'Neaktivni' },
            ],
          },
          ...(rankOptions.length > 1 ? [{ id: 'rank', label: 'Rang', options: rankOptions }] : []),
        ]}
        initialSort={[{ id: 'name', desc: false }]}
        getRowId={(o) => String(o.id)}
        onRowClick={(o) => setHistory(o)}
        countLabel="sodnikov"
        emptyTitle="Še ni sodnikov"
        emptyDescription={isAdmin ? 'Dodajte prvega sodnika ali uvozite seznam iz Excela.' : undefined}
        emptyAction={
          isAdmin ? (
            <Button onClick={() => setEditing({})}>
              <Plus /> Dodaj sodnika
            </Button>
          ) : undefined
        }
      />

      <OfficialSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} official={editing?.official} />
      <OfficialHistorySheet official={history} onClose={() => setHistory(null)} />
      <ImportDialog preview={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Izbris sodnika"
        description={`Ali res želite izbrisati sodnika »${deleting?.name ?? ''}«? Sodnika z dodelitvami ni mogoče izbrisati – deaktivirajte ga.`}
        confirmLabel="Izbriši"
        destructive
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
      />
    </div>
  );
}
