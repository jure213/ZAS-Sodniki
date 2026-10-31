// Danger zone: clear all data. Two steps: warning dialog, then type the word.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApiMutation } from '@/lib/api';

const WORD = 'IZBRIŠI';

export function DangerTab() {
  const qc = useQueryClient();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');
  const clear = useApiMutation('config:clearAllData', {
    onSuccess: async () => {
      setStep(0);
      await qc.invalidateQueries();
      toast.success('Vsi podatki so bili izbrisani.');
    },
  });
  const close = () => {
    setStep(0);
    setTyped('');
  };

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-destructive">Izbris vseh podatkov</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Trajno izbriše vse sodnike, tekmovanja, dodelitve in izplačila ter vse druge uporabnike. Ohranijo se vaš račun in nastavitve
              (vloge, discipline, tarife). Dejanja ni mogoče razveljaviti.
            </p>
            <Button variant="destructive" className="mt-4" onClick={() => setStep(1)}>
              <Trash2 /> Izbriši vse podatke
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={step === 1} onOpenChange={(o) => !o && close()}>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle>Ste prepričani?</DialogTitle>
            <DialogDescription>
              Izbrisani bodo vsi sodniki, tekmovanja, izplačila in drugi uporabniki. Pred nadaljevanjem priporočamo izvoz podatkov v Excel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Prekliči
            </Button>
            <Button variant="destructive" onClick={() => setStep(2)}>
              Nadaljuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === 2} onOpenChange={(o) => !o && !clear.isPending && close()}>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle>Končna potrditev</DialogTitle>
            <DialogDescription>
              Za potrditev vpišite <b className="font-mono text-foreground">{WORD}</b>.
            </DialogDescription>
          </DialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus aria-label="Potrditvena beseda" placeholder={WORD} />
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={clear.isPending}>
              Prekliči
            </Button>
            <Button
              variant="destructive"
              disabled={typed.trim().toLocaleUpperCase('sl') !== WORD || clear.isPending}
              onClick={() => clear.mutate({ confirm: true })}
            >
              {clear.isPending ? 'Brišem…' : 'Dokončno izbriši'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
