import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Car, Download, KeyRound, Wallet } from 'lucide-react';
import { appConfigSchema } from '@shared/schemas';
import { PAYMENT_METHOD_LABELS } from '@shared/labels';
import type { PaymentMethod } from '@shared/types';
import { Field } from '@/components/Field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { isValidationError, qk, useApiMutation } from '@/lib/api';
import { useConfig, usePrefs } from '@/lib/hooks';
import { call } from '@/lib/ipc';

const toText = (n: number) => String(n).replace('.', ',');

export function GeneralTab() {
  const prefs = usePrefs();
  const config = useConfig();

  const setPrefs = useApiMutation('prefs:set', {
    invalidate: [qk.prefs],
    success: 'Nastavitev shranjena',
  });

  const [km, setKm] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('nakazilo');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (config.data) {
      setKm(toText(config.data.travel_cost_per_km));
      setMethod(config.data.default_payment_method);
    }
  }, [config.data]);

  const save = useApiMutation('config:update', { silent: true, invalidate: [qk.config], success: 'Nastavitve shranjene' });
  const dirty =
    !!config.data && (km !== toText(config.data.travel_cost_per_km) || method !== config.data.default_payment_method);

  function submit() {
    setError(null);
    const num = Number(km.trim().replace(',', '.'));
    const parsed = appConfigSchema.safeParse({
      travel_cost_per_km: km.trim() === '' ? undefined : num,
      default_payment_method: method,
    });
    if (!parsed.success || Number.isNaN(num)) {
      setError(parsed.success ? 'Vnesite veljaven znesek' : parsed.error.issues[0].message);
      return;
    }
    save.mutate(parsed.data, { onError: (e) => setError(isValidationError(e) ? e.message : (e as Error).message) });
  }

  const [checking, setChecking] = useState(false);
  async function checkUpdates() {
    setChecking(true);
    let off: (() => void) | undefined;
    try {
      const notAvailable = new Promise<boolean>((resolve) => {
        off = window.api.on('updater:not-available', () => resolve(true));
        setTimeout(() => resolve(false), 8000);
      });
      const res = await call('updater:check');
      if (!res.checked) {
        toast.info('Preverjanje posodobitev ni na voljo v razvojni različici.');
      } else if (await notAvailable) {
        toast.success('Uporabljate najnovejšo različico.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preverjanje ni uspelo.');
    } finally {
      off?.();
      setChecking(false);
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Prijava
          </CardTitle>
          <CardDescription>Velja od naslednje prijave.</CardDescription>
        </CardHeader>
        <CardContent>
          {prefs.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Ostani prijavljen</p>
                <p className="text-xs text-muted-foreground">
                  Prijava se shrani med zagoni aplikacije (največ 30 dni).
                </p>
              </div>
              <Switch
                checked={prefs.data?.rememberMe ?? false}
                disabled={setPrefs.isPending}
                onCheckedChange={(v) => setPrefs.mutate({ rememberMe: v })}
              />
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="size-4" /> Obračun
          </CardTitle>
          <CardDescription>Cena na kilometer se zamrzne ob dodelitvi sodnika na tekmovanje.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cena na kilometer (€/km)" htmlFor="g-km" hint="Največ štiri decimalke, npr. 0,37">
                  <div className="relative">
                    <Input
                      id="g-km"
                      inputMode="decimal"
                      value={km}
                      className="pr-12 text-right tabular-nums"
                      onChange={(e) => setKm(e.target.value)}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">€/km</span>
                  </div>
                </Field>
                <Field label="Privzeti način plačila" htmlFor="g-method">
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger id="g-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, l]) => (
                        <SelectItem key={k} value={k}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end">
                <Button disabled={!dirty || save.isPending} onClick={submit}>
                  <Wallet /> {save.isPending ? 'Shranjujem…' : 'Shrani'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4" /> Posodobitve
          </CardTitle>
          <CardDescription>Aplikacija ob zagonu samodejno preveri za posodobitve. Tukaj lahko preverjanje sprožite ročno.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled={checking} onClick={() => void checkUpdates()}>
            {checking ? 'Preverjam…' : 'Preveri za posodobitve'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
