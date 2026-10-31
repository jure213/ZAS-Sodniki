// Add / edit an official in a right-hand sheet (react-hook-form + shared zod schema).

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { officialSchema } from '@shared/schemas';
import type { Official } from '@shared/types';
import { Field } from '@/components/Field';
import { useUnsavedGuard } from '@/components/useUnsavedGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { isValidationError, qk, useApiMutation } from '@/lib/api';

type FormIn = z.input<typeof officialSchema>;
type FormOut = z.output<typeof officialSchema>;

const EMPTY: FormIn = { name: '', email: '', phone: '', rank: '', additional_exams: '', notes: '', active: true };

export function OfficialSheet({
  open,
  onOpenChange,
  official,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Undefined = create a new official. */
  official?: Official;
}) {
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(officialSchema), defaultValues: EMPTY });
  const { errors, isDirty } = form.formState;
  const { guard, dialog } = useUnsavedGuard(isDirty);

  useEffect(() => {
    if (open) form.reset(official ? { ...official } : EMPTY);
  }, [open, official, form]);

  const create = useApiMutation('officials:create', { silent: true, invalidate: [qk.officials.all, qk.dashboard.all] });
  const update = useApiMutation('officials:update', { silent: true, invalidate: [qk.officials.all, qk.dashboard.all] });
  const saving = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (official) await update.mutateAsync({ id: official.id, data });
      else await create.mutateAsync(data);
      form.reset(data); // clean, so closing does not ask
      onOpenChange(false);
    } catch (e) {
      form.setError('root', { message: isValidationError(e) || e instanceof Error ? e.message : 'Shranjevanje ni uspelo.' });
    }
  });

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : guard(() => onOpenChange(false)))}>
        <SheetContent>
          <form onSubmit={onSubmit} className="flex h-full flex-col" noValidate>
            <SheetHeader>
              <SheetTitle>{official ? 'Uredi sodnika' : 'Nov sodnik'}</SheetTitle>
              <SheetDescription>{official ? 'Spremenite podatke o sodniku.' : 'Vnesite podatke o novem sodniku.'}</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-4">
              {errors.root && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {errors.root.message}
                </div>
              )}
              <Field label="Ime in priimek" htmlFor="o-name" required error={errors.name?.message}>
                <Input id="o-name" autoFocus aria-invalid={!!errors.name} {...form.register('name')} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="E-pošta" htmlFor="o-email" error={errors.email?.message}>
                  <Input id="o-email" type="email" aria-invalid={!!errors.email} {...form.register('email')} />
                </Field>
                <Field label="Telefon" htmlFor="o-phone" error={errors.phone?.message}>
                  <Input id="o-phone" {...form.register('phone')} />
                </Field>
              </div>
              <Field label="Rang" htmlFor="o-rank" error={errors.rank?.message}>
                <Input id="o-rank" {...form.register('rank')} />
              </Field>
              <Field label="Dodatni izpiti" htmlFor="o-exams" error={errors.additional_exams?.message}>
                <Textarea id="o-exams" rows={3} {...form.register('additional_exams')} />
              </Field>
              <Field label="Opombe" htmlFor="o-notes" error={errors.notes?.message}>
                <Textarea id="o-notes" rows={3} {...form.register('notes')} />
              </Field>
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div>
                      <Label htmlFor="o-active">Aktiven sodnik</Label>
                      <p className="mt-1 text-xs text-muted-foreground">Neaktivni sodniki se ne ponujajo pri dodeljevanju na tekmovanja.</p>
                    </div>
                    <Switch id="o-active" checked={!!field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => guard(() => onOpenChange(false))}>
                Prekliči
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Shranjujem…' : 'Shrani'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  );
}
