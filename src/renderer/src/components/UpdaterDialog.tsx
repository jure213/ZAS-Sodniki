import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { UpdateInfo } from '@shared/ipc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { call } from '@/lib/ipc';

// Release notes arrive as HTML from GitHub. Show them as plain text: parse in
// an inert document (no scripts run, nothing loads) and keep only the text.
function releaseNotesText(notes: UpdateInfo['releaseNotes']): string {
  const raw = Array.isArray(notes) ? notes.map((n) => n?.note ?? '').join('\n\n') : String(notes ?? '');
  const withBreaks = raw.replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div)>/gi, '$&\n');
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
  return (doc.body.textContent || '').trim();
}

type Phase = 'idle' | 'available' | 'downloading' | 'ready';

export function UpdaterDialog() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const offs = [
      window.api.on('updater:available', (i) => {
        setInfo(i);
        setPhase('available');
      }),
      window.api.on('updater:progress', (p) => setPercent(p.percent)),
      window.api.on('updater:downloaded', () => setPhase('ready')),
      window.api.on('updater:error', (m) => {
        setPhase('idle');
        toast.error(`Napaka pri posodobitvi: ${m}`);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  async function download() {
    setPhase('downloading');
    try {
      await call('updater:download');
    } catch (e) {
      setPhase('idle');
      toast.error(e instanceof Error ? e.message : 'Prenos ni uspel.');
    }
  }

  const notes = info?.releaseNotes ? releaseNotesText(info.releaseNotes) : '';

  return (
    <Dialog open={phase !== 'idle'} onOpenChange={(o) => !o && phase !== 'downloading' && setPhase('idle')}>
      <DialogContent showClose={phase !== 'downloading'}>
        {phase === 'available' && (
          <>
            <DialogHeader>
              <DialogTitle>Nova posodobitev na voljo</DialogTitle>
              <DialogDescription>
                Verzija {info?.version} je na voljo za prenos. Trenutna verzija: {info?.currentVersion ?? 'neznana'}.
              </DialogDescription>
            </DialogHeader>
            {notes && <div className="max-h-48 overflow-y-auto text-sm whitespace-pre-wrap">{notes}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPhase('idle')}>
                Pozneje
              </Button>
              <Button onClick={download}>Prenesi posodobitev</Button>
            </DialogFooter>
          </>
        )}
        {phase === 'downloading' && (
          <DialogHeader>
            <DialogTitle>Prenašanje posodobitve</DialogTitle>
            <DialogDescription>{Math.round(percent)} %</DialogDescription>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div className="brand-gradient h-full" style={{ width: `${percent}%` }} />
            </div>
          </DialogHeader>
        )}
        {phase === 'ready' && (
          <>
            <DialogHeader>
              <DialogTitle>Posodobitev je pripravljena</DialogTitle>
              <DialogDescription>Aplikacija se bo ponovno zagnala in namestila posodobitev.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPhase('idle')}>
                Pozneje
              </Button>
              <Button onClick={() => void call('updater:install')}>Namesti in znova zaženi</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
