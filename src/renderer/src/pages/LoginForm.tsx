import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import type { AppUser } from '@shared/ipc';
import { loginSchema } from '@shared/schemas';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { call, IpcCallError } from '@/lib/ipc';

type Props = {
  onSuccess: (user: AppUser) => void;
  /** Shown above the form, e.g. "Seja je potekla." */
  notice?: string;
  idPrefix?: string;
};

export function LoginForm({ onSuccess, notice, idPrefix = 'login' }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call('prefs:get')
      .then((p) => setRemember(p.rememberMe))
      .catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ username, password, remember });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Neveljavni podatki.');
      return;
    }
    setBusy(true);
    try {
      onSuccess(await call('auth:login', parsed.data));
    } catch (err) {
      setError(err instanceof IpcCallError ? err.message : 'Napaka pri prijavi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {notice && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-username`}>Uporabniško ime</Label>
        <Input
          id={`${idPrefix}-username`}
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-password`}>Geslo</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`${idPrefix}-remember`} checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
        <Label htmlFor={`${idPrefix}-remember`} className="font-normal">
          Zapomni si me
        </Label>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        Prijava
      </Button>
    </form>
  );
}
