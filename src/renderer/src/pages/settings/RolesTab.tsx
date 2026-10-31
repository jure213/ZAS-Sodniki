import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Role } from '@shared/types';
import { DataTable } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { qk, useApiMutation } from '@/lib/api';
import { useRoles } from '@/lib/hooks';
import { RoleSheet } from './RoleSheet';
import { summarize } from './tiers';
import { UsageConfirm } from './UsageConfirm';

function Tiers({ lines }: { lines: string[] }) {
  if (!lines.length) return <span className="text-muted-foreground/60">–</span>;
  return (
    <div className="space-y-0.5 text-xs tabular-nums">
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  );
}

export function RolesTab() {
  const roles = useRoles();
  const [editing, setEditing] = useState<{ role?: Role } | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const del = useApiMutation('roles:delete', {
    invalidate: [qk.roles.all],
    onSuccess: (r) => {
      if (r.result === 'archived') toast.info('Vloga je uporabljena, zato je bila arhivirana namesto izbrisana.');
      else toast.success('Vloga izbrisana');
    },
  });
  const restore = useApiMutation('roles:save', { invalidate: [qk.roles.all], success: 'Vloga obnovljena' });

  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Vloga',
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium">
            {row.original.name}
            {row.original.archived && <Badge variant="secondary">Arhivirana</Badge>}
          </span>
        ),
      },
      {
        id: 'rates',
        header: 'Tarifa sodnik',
        enableSorting: false,
        cell: ({ row }) => <Tiers lines={summarize(row.original.rates)} />,
      },
      {
        id: 'invoice',
        header: 'Tarifa račun',
        enableSorting: false,
        cell: ({ row }) => <Tiers lines={summarize(row.original.invoiceRates)} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { align: 'right', className: 'w-32' },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex justify-end gap-1">
              {r.archived && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    restore.mutate({ id: r.id, name: r.name, rates: r.rates, invoiceRates: r.invoiceRates, archived: false })
                  }
                >
                  Obnovi
                </Button>
              )}
              <Hint label="Uredi">
                <Button variant="ghost" size="icon" className="size-7" aria-label="Uredi" onClick={() => setEditing({ role: r })}>
                  <Pencil />
                </Button>
              </Hint>
              <Hint label="Odstrani">
                <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" aria-label="Odstrani" onClick={() => setDeleting(r)}>
                  <Trash2 />
                </Button>
              </Hint>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div>
      <DataTable
        columns={columns}
        data={roles.data ?? []}
        loading={roles.isLoading}
        error={roles.error}
        onRetry={() => void roles.refetch()}
        getRowId={(r) => String(r.id)}
        maxHeightClass="max-h-[calc(100vh-18rem)]"
        searchText={(r) => r.name}
        searchPlaceholder="Poišči vlogo…"
        countLabel="vlog"
        emptyTitle="Še ni vlog"
        toolbar={
          <Button onClick={() => setEditing({})}>
            <Plus /> Dodaj vlogo
          </Button>
        }
      />
      <RoleSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} role={editing?.role} />
      <UsageConfirm
        kind="role"
        target={deleting}
        pending={del.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id }, { onSettled: () => setDeleting(null) })}
      />
    </div>
  );
}
