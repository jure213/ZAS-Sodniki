// Preview of an Excel import: rows to insert / skipped duplicates / errors, then confirm.

import { AlertTriangle, CopyX, UserPlus } from 'lucide-react';
import type { ImportPreview } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { qk, useApiMutation } from '@/lib/api';

export function ImportDialog({ preview, onClose }: { preview: ImportPreview | null; onClose: () => void }) {
  const confirm = useApiMutation('officials:importConfirm', {
    invalidate: [qk.officials.all, qk.dashboard.all],
    success: (r) => `Uvoženih sodnikov: ${r.inserted}`,
    onSuccess: () => onClose(),
  });

  const p = preview;
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && !confirm.isPending && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Uvoz sodnikov iz Excela</DialogTitle>
          <DialogDescription>{p?.fileName}</DialogDescription>
        </DialogHeader>
        {p && (
          <Tabs defaultValue={p.toInsert.length === 0 && p.errors.length > 0 ? 'errors' : 'insert'}>
            <TabsList>
              <TabsTrigger value="insert">
                <UserPlus /> Za uvoz ({p.toInsert.length})
              </TabsTrigger>
              <TabsTrigger value="skipped">
                <CopyX /> Preskočeni ({p.skippedDuplicates.length})
              </TabsTrigger>
              <TabsTrigger value="errors">
                <AlertTriangle /> Napake ({p.errors.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="insert">
              {p.toInsert.length === 0 ? (
                <EmptyState title="Ni novih sodnikov za uvoz" />
              ) : (
                <Table containerClassName="max-h-80 rounded-lg border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vrstica</TableHead>
                      <TableHead>Ime</TableHead>
                      <TableHead>E-pošta</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Rang</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.toInsert.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="text-muted-foreground">{r.row}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{r.phone}</TableCell>
                        <TableCell>{r.rank}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            <TabsContent value="skipped">
              {p.skippedDuplicates.length === 0 ? (
                <EmptyState title="Ni podvojenih sodnikov" />
              ) : (
                <Table containerClassName="max-h-80 rounded-lg border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vrstica</TableHead>
                      <TableHead>Ime</TableHead>
                      <TableHead>Razlog</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.skippedDuplicates.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="text-muted-foreground">{r.row}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.reason === 'database' ? 'Sodnik že obstaja v bazi' : 'Podvojeno v datoteki'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            <TabsContent value="errors">
              {p.errors.length === 0 ? (
                <EmptyState title="Brez napak" />
              ) : (
                <Table containerClassName="max-h-80 rounded-lg border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vrstica</TableHead>
                      <TableHead>Napaka</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.errors.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{r.row}</TableCell>
                        <TableCell className="text-destructive">{r.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={confirm.isPending}>
            Prekliči
          </Button>
          <Button
            disabled={!p || p.toInsert.length === 0 || confirm.isPending}
            onClick={() =>
              p &&
              confirm.mutate({
                rows: p.toInsert.map(({ name, email, phone, rank, additional_exams }) => ({ name, email, phone, rank, additional_exams })),
              })
            }
          >
            {confirm.isPending ? 'Uvažam…' : `Uvozi ${p?.toInsert.length ?? 0} sodnikov`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
