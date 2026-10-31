// Delete confirmation that first loads where the item is used (roles / disciplines)
// and explains whether it will be deleted or archived.

import { useQuery } from '@tanstack/react-query';
import { Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { call } from '@/lib/ipc';

export function UsageConfirm({
  kind,
  target,
  onClose,
  onConfirm,
  pending,
}: {
  kind: 'role' | 'discipline';
  target: { id: number; name: string } | null;
  onClose: () => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const noun = kind === 'role' ? 'vlogo' : 'disciplino';
  const usage = useQuery({
    queryKey: [kind === 'role' ? 'roles' : 'disciplines', 'usage', target?.id],
    queryFn: () => call(kind === 'role' ? 'roles:usage' : 'disciplines:usage', { id: target!.id }),
    enabled: !!target,
    staleTime: 0,
    gcTime: 0,
  });
  const count = usage.data?.count ?? 0;
  const used = count > 0;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>Odstrani {noun}</DialogTitle>
          <DialogDescription>»{target?.name}«</DialogDescription>
        </DialogHeader>
        {usage.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : usage.error ? (
          <p className="text-sm text-destructive">Uporabe ni bilo mogoče preveriti.</p>
        ) : used ? (
          <div className="space-y-2 text-sm">
            <p>
              Uporabljena je pri <b>{count}</b> dodelitvah, zato bo <b>arhivirana</b> (skrita pri novih dodelitvah, obstoječi
              podatki ostanejo).
            </p>
            <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-muted-foreground">
              {usage.data!.items.slice(0, 8).map((i) => (
                <li key={i.assignment_id}>
                  {i.competition_name} – {i.official_name}
                </li>
              ))}
              {count > 8 && <li>… in še {count - 8}</li>}
            </ul>
          </div>
        ) : (
          <p className="text-sm">Ni uporabljena, zato bo trajno <b>izbrisana</b>.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Prekliči
          </Button>
          <Button variant="destructive" disabled={usage.isLoading || !!usage.error || pending} onClick={onConfirm}>
            {used ? <Archive /> : <Trash2 />}
            {used ? 'Arhiviraj' : 'Izbriši'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
