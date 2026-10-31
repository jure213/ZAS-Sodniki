import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Discipline } from '@shared/types';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Hint } from '@/components/ui/tooltip';
import { qk, useApiMutation } from '@/lib/api';
import { useDisciplines } from '@/lib/hooks';
import { UsageConfirm } from './UsageConfirm';

export function DisciplinesTab() {
  const list = useDisciplines();
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<Discipline | null>(null);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<Discipline | null>(null);

  const invalidate = [qk.disciplines.all];
  const add = useApiMutation('disciplines:add', { invalidate, success: 'Disciplina dodana', onSuccess: () => setName('') });
  const rename = useApiMutation('disciplines:update', { invalidate, success: 'Disciplina shranjena' });
  const reorder = useApiMutation('disciplines:reorder', { invalidate });
  const del = useApiMutation('disciplines:delete', {
    invalidate,
    onSuccess: (r) => {
      if (r.result === 'archived') toast.info('Disciplina je uporabljena, zato je bila arhivirana namesto izbrisana.');
      else toast.success('Disciplina izbrisana');
    },
  });

  const items = list.data ?? [];
  function move(index: number, dir: -1 | 1) {
    const ids = items.map((d) => d.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate({ ids });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate({ name: name.trim() });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova disciplina, npr. Met kopja" className="bg-card" aria-label="Nova disciplina" />
        <Button type="submit" disabled={!name.trim() || add.isPending}>
          <Plus /> Dodaj
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Še ni disciplin" description="Dodajte prvo disciplino zgoraj." />
        ) : (
          <ul className="divide-y">
            {items.map((d, i) => (
              <li key={d.id} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/40">
                <span className="w-6 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className="flex-1 font-medium">
                  {d.name} {d.archived && <Badge variant="secondary" className="ml-2">Arhivirana</Badge>}
                </span>
                {d.archived && (
                  <Button variant="ghost" size="sm" onClick={() => rename.mutate({ id: d.id, archived: false })}>
                    Obnovi
                  </Button>
                )}
                <Hint label="Premakni više">
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Premakni više" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                </Hint>
                <Hint label="Premakni niže">
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Premakni niže" disabled={i === items.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                </Hint>
                <Hint label="Preimenuj">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Preimenuj"
                    onClick={() => {
                      setRenaming(d);
                      setNewName(d.name);
                    }}
                  >
                    <Pencil />
                  </Button>
                </Hint>
                <Hint label="Odstrani">
                  <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" aria-label="Odstrani" onClick={() => setDeleting(d)}>
                    <Trash2 />
                  </Button>
                </Hint>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming && newName.trim())
                rename.mutate({ id: renaming.id, name: newName.trim() }, { onSuccess: () => setRenaming(null) });
            }}
          >
            <DialogHeader>
              <DialogTitle>Preimenuj disciplino</DialogTitle>
            </DialogHeader>
            <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Ime discipline" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
                Prekliči
              </Button>
              <Button type="submit" disabled={!newName.trim() || rename.isPending}>
                Shrani
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UsageConfirm
        kind="discipline"
        target={deleting}
        pending={del.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id }, { onSettled: () => setDeleting(null) })}
      />
    </div>
  );
}
