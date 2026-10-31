// Add / edit a user. On edit the password is optional (omitted when empty = unchanged).

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { USER_ROLE_LABELS } from '@shared/labels';
import { userCreateSchema, userSchema } from '@shared/schemas';
import type { UserRow } from '@shared/types';
import { Field } from '@/components/Field';
import { useUnsavedGuard } from '@/components/useUnsavedGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { qk, useApiMutation } from '@/lib/api';

const editSchema = userSchema.extend({
  password: z.union([z.literal(''), z.string().min(6, 'Geslo mora imeti vsaj 6 znakov')]).optional(),
});
type Form = { username: string; name: string; role: 'admin' | 'user'; password?: string };

const EMPTY: Form = { username: '', name: '', role: 'user', password: '' };

export function UserSheet({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user?: UserRow }) {
  const editing = !!user;
  const form = useForm<Form>({
    resolver: zodResolver(editing ? editSchema : userCreateSchema) as never,
    defaultValues: EMPTY,
  });
  const { errors, isDirty } = form.formState;
  const { guard, dialog } = useUnsavedGuard(isDirty);

  useEffect(() => {
    if (open) form.reset(user ? { username: user.username, name: user.name, role: user.role === 'admin' ? 'admin' : 'user', password: '' } : EMPTY);
  }, [open, user, form]);

  const create = useApiMutation('users:create', { silent: true, invalidate: [qk.users.all], success: 'Uporabnik dodan' });
  const update = useApiMutation('users:update', { silent: true, invalidate: [qk.users.all], success: 'Uporabnik shranjen' });
  const saving = create.isPending || update.isPending;

  const submit = form.handleSubmit(async (data) => {
    try {
      if (user) {
        const { password, ...rest } = data;
        await update.mutateAsync({ id: user.id, data: password ? { ...rest, password } : rest });
      } else {
        await create.mutateAsync({ ...data, password: data.password ?? '' });
      }
      form.reset(data);
      onOpenChange(false);
    } catch (e) {
      form.setError('root', { message: e instanceof Error ? e.message : 'Shranjevanje ni uspelo.' });
    }
  });

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : guard(() => onOpenChange(false)))}>
        <SheetContent>
          <form onSubmit={submit} className="flex h-full flex-col" noValidate>
            <SheetHeader>
              <SheetTitle>{editing ? 'Uredi uporabnika' : 'Nov uporabnik'}</SheetTitle>
              <SheetDescription>
                {editing ? 'Geslo pustite prazno, če ga ne želite spremeniti.' : 'Uporabnik se bo lahko prijavil z uporabniškim imenom in geslom.'}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-4">
              {errors.root && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {errors.root.message}
                </div>
              )}
              <Field label="Ime in priimek" htmlFor="u-name" required error={errors.name?.message}>
                <Input id="u-name" autoFocus aria-invalid={!!errors.name} {...form.register('name')} />
              </Field>
              <Field label="Uporabniško ime" htmlFor="u-username" required error={errors.username?.message}>
                <Input id="u-username" autoComplete="off" aria-invalid={!!errors.username} {...form.register('username')} />
              </Field>
              <Field label="Vloga" htmlFor="u-role" required error={errors.role?.message}>
                <Controller
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="u-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{USER_ROLE_LABELS.user} (samo ogled)</SelectItem>
                        <SelectItem value="admin">{USER_ROLE_LABELS.admin} (polni dostop)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label={editing ? 'Novo geslo' : 'Geslo'}
                htmlFor="u-password"
                required={!editing}
                error={errors.password?.message}
                hint={editing ? 'Neobvezno. Sprememba gesla odjavi uporabnika povsod.' : 'Vsaj 6 znakov.'}
              >
                <Input id="u-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
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
