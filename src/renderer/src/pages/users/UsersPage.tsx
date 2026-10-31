import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { USER_ROLE_LABELS } from '@shared/labels';
import { formatDate } from '@shared/dates';
import type { UserRow } from '@shared/types';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { qk, useApiMutation } from '@/lib/api';
import { useUsers } from '@/lib/hooks';
import { UserSheet } from './UserSheet';

/** Admin only. */
export function UsersPage() {
  const { user: me } = useAuth();
  const users = useUsers();
  const [editing, setEditing] = useState<{ user?: UserRow } | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const del = useApiMutation('users:delete', { invalidate: [qk.users.all], success: 'Uporabnik izbrisan' });

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Ime in priimek',
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.name}
            {row.original.id === me?.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(vi)</span>}
          </span>
        ),
      },
      { accessorKey: 'username', header: 'Uporabniško ime' },
      {
        accessorKey: 'role',
        header: 'Vloga',
        cell: (c) =>
          c.getValue<string>() === 'admin' ? (
            <Badge>{USER_ROLE_LABELS.admin}</Badge>
          ) : (
            <Badge variant="secondary">{USER_ROLE_LABELS.user}</Badge>
          ),
      },
      { accessorKey: 'created_at', header: 'Ustvarjen', cell: (c) => formatDate(c.getValue<string>()) },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { align: 'right', className: 'w-24' },
        cell: ({ row }) => {
          const u = row.original;
          const self = u.id === me?.id;
          return (
            <div className="flex justify-end gap-1">
              <Hint label="Uredi">
                <Button variant="ghost" size="icon" className="size-7" aria-label="Uredi" onClick={() => setEditing({ user: u })}>
                  <Pencil />
                </Button>
              </Hint>
              <Hint label={self ? 'Lastnega računa ni mogoče izbrisati' : 'Izbriši'}>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 hover:text-destructive"
                    aria-label="Izbriši"
                    disabled={self}
                    onClick={() => setDeleting(u)}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </Hint>
            </div>
          );
        },
      },
    ],
    [me?.id],
  );

  return (
    <div>
      <PageHeader
        title="Uporabniki"
        description="Računi za prijavo v aplikacijo"
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus /> Dodaj uporabnika
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={users.data ?? []}
        loading={users.isLoading}
        error={users.error}
        onRetry={() => void users.refetch()}
        searchText={(u) => `${u.name} ${u.username}`}
        searchPlaceholder="Poišči uporabnika…"
        initialSort={[{ id: 'name', desc: false }]}
        getRowId={(u) => String(u.id)}
        countLabel="uporabnikov"
      />
      <UserSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} user={editing?.user} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Izbris uporabnika"
        description={`Ali res želite izbrisati uporabnika »${deleting?.username ?? ''}«?`}
        confirmLabel="Izbriši"
        destructive
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
      />
    </div>
  );
}
