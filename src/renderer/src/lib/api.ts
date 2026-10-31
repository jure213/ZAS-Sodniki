// Renderer-side API layer: typed TanStack Query hooks over the IPC channels.
//
//   const officials = useApiQuery('officials:list', undefined, qk.officials.list)
//   const save = useApiMutation('officials:create', { invalidate: [qk.officials.all], success: 'Sodnik dodan' })
//
// Errors from main (Result { ok: false }) are thrown as IpcCallError by `call`;
// mutation errors are toasted centrally (see MutationCache in main.tsx) with the
// Slovenian message from main, unless the mutation sets `meta: { silent: true }`
// (then the caller shows the error inline).

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ChannelInput, ChannelName, ChannelOutput, InvokeArgs } from '@shared/ipc';
import { call, IpcCallError } from '@/lib/ipc';

/** Central query keys. Invalidate by prefix (e.g. qk.officials.all). */
export const qk = {
  officials: {
    all: ['officials'] as const,
    list: ['officials', 'list'] as const,
    history: (id: number) => ['officials', 'history', id] as const,
  },
  competitions: {
    all: ['competitions'] as const,
    list: ['competitions', 'list'] as const,
    detail: (id: number) => ['competitions', 'detail', id] as const,
  },
  assignments: {
    all: ['assignments'] as const,
    list: (competitionId: number) => ['assignments', 'list', competitionId] as const,
  },
  roles: { all: ['roles'] as const, list: ['roles', 'list'] as const, usage: (id: number) => ['roles', 'usage', id] as const },
  disciplines: {
    all: ['disciplines'] as const,
    list: ['disciplines', 'list'] as const,
    usage: (id: number) => ['disciplines', 'usage', id] as const,
  },
  config: ['config'] as const,
  prefs: ['prefs'] as const,
  payments: {
    all: ['payments'] as const,
    list: (filter?: unknown) => ['payments', 'list', filter ?? null] as const,
    detail: (id: number) => ['payments', 'detail', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    stats: (year?: number) => ['dashboard', 'stats', year ?? null] as const,
    owed: ['dashboard', 'owed'] as const,
  },
  users: { all: ['users'] as const, list: ['users', 'list'] as const },
};

/** Message to show for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof IpcCallError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Prišlo je do nepričakovane napake.';
}

/** Toast an error unless the session expired (the login dialog handles that). */
export function toastError(e: unknown) {
  if (e instanceof IpcCallError && e.code === 'SESSION_EXPIRED') return;
  toast.error(errorMessage(e));
}

/** True for validation-type errors that a form can show inline. */
export function isValidationError(e: unknown): e is IpcCallError {
  return e instanceof IpcCallError && (e.code === 'VALIDATION' || e.code === 'CONFLICT');
}

/** Typed query. `input` is the channel input (omit/undefined for void channels). */
export function useApiQuery<C extends ChannelName>(
  channel: C,
  input: ChannelInput<C> | undefined,
  key: QueryKey,
  options?: Omit<UseQueryOptions<ChannelOutput<C>>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ChannelOutput<C>>({
    queryKey: key,
    queryFn: () => call(channel, ...((input === undefined ? [] : [input]) as unknown as InvokeArgs<ChannelInput<C>>)),
    ...options,
  });
}

type MutationExtras<C extends ChannelName> = {
  /** Query key prefixes to invalidate on success. */
  invalidate?: QueryKey[];
  /** Success toast text (or a function of the result). */
  success?: string | ((data: ChannelOutput<C>) => string);
  /** Do not toast errors (caller handles them, e.g. inline in a form). */
  silent?: boolean;
};

/** Typed mutation with invalidation, success toast and central error toast. */
export function useApiMutation<C extends ChannelName>(
  channel: C,
  extras: MutationExtras<C> & Omit<UseMutationOptions<ChannelOutput<C>, Error, ChannelInput<C>>, 'mutationFn'> = {},
) {
  const qc = useQueryClient();
  const { invalidate, success, silent, onSuccess, ...rest } = extras;
  return useMutation<ChannelOutput<C>, Error, ChannelInput<C>>({
    ...rest,
    meta: { silent: !!silent },
    mutationFn: (input) =>
      call(channel, ...((input === undefined ? [] : [input]) as unknown as InvokeArgs<ChannelInput<C>>)),
    onSuccess: async (data, vars, ctx, mctx) => {
      if (invalidate?.length) await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      if (success) toast.success(typeof success === 'function' ? success(data) : success);
      await onSuccess?.(data, vars, ctx, mctx);
    },
  });
}
