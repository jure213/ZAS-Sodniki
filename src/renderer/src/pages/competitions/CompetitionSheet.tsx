// Add / edit a competition in a right-hand sheet (react-hook-form + shared zod schema).

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { STATUS_LABELS } from '@shared/labels';
import { competitionSchema } from '@shared/schemas';
import { todayIso } from '@shared/dates';
import type { Competition } from '@shared/types';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { useUnsavedGuard } from '@/components/useUnsavedGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { isValidationError, qk, useApiMutation } from '@/lib/api';

type FormIn = z.input<typeof competitionSchema>;
type FormOut = z.output<typeof competitionSchema>;

const emptyForm = (): FormIn => ({ name: '', date: todayIso(), location: '', status: 'planned', notes: '' });

export function CompetitionSheet({
  open,
  onOpenChange,
  competition,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Undefined = create a new competition. */
  competition?: Competition;
  onSaved?: (c: Competition) => void;
}) {
  const form = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(competitionSchema), defaultValues: emptyForm() });
  const { errors, isDirty } = form.formState;
  const { guard, dialog } = useUnsavedGuard(isDirty);

  useEffect(() => {
    if (open) form.reset(competition ? { ...competition } : emptyForm());
  }, [open, competition, form]);

  // Status changes affect amounts of free / other_zas competitions, so refresh assignments too.
  const invalidate = [qk.competitions.all, qk.assignments.all, qk.dashboard.all];
  const create = useApiMutation('competitions:create', { silent: true, invalidate, success: 'Tekmovanje dodano' });
  const update = useApiMutation('competitions:update', { silent: true, invalidate, success: 'Tekmovanje shranjeno' });
  const saving = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const saved = competition ? await update.mutateAsync({ id: competition.id, data }) : await create.mutateAsync(data);
      form.reset(data); // clean, so closing does not ask
      onOpenChange(false);
      onSaved?.(saved);
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
              <SheetTitle>{competition ? 'Uredi tekmovanje' : 'Novo tekmovanje'}</SheetTitle>
              <SheetDescription>
                {competition ? 'Spremenite podatke o tekmovanju.' : 'Vnesite podatke o novem tekmovanju.'}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-4">
              {errors.root && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {errors.root.message}
                </div>
              )}
              <Field label="Ime tekmovanja" htmlFor="c-name" required error={errors.name?.message}>
                <Input id="c-name" autoFocus aria-invalid={!!errors.name} {...form.register('name')} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Datum" htmlFor="c-date" required error={errors.date?.message}>
                  <Controller
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <DateField id="c-date" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.date} />
                    )}
                  />
                </Field>
                <Field label="Status" htmlFor="c-status" required error={errors.status?.message}>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="c-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, l]) => (
                            <SelectItem key={k} value={k}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
              <Field label="Lokacija" htmlFor="c-location" error={errors.location?.message}>
                <Input id="c-location" {...form.register('location')} />
              </Field>
              <Field
                label="Opombe"
                htmlFor="c-notes"
                error={errors.notes?.message}
                hint={
                  competition
                    ? 'Če status spremenite iz »Zastonj« ali »Plača drug ZAS« v plačljivega, preračunajte zneske dodelitev na strani tekmovanja.'
                    : undefined
                }
              >
                <Textarea id="c-notes" rows={4} {...form.register('notes')} />
              </Field>
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
