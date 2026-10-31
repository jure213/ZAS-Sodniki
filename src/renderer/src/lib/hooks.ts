// Domain query hooks. Mutations are used directly via useApiMutation in the pages.

import { toast } from 'sonner';
import type { PaymentFilter } from '@shared/schemas';
import type { SaveFileResult } from '@shared/types';
import { useApiMutation, useApiQuery, qk } from '@/lib/api';

export const useOfficials = () => useApiQuery('officials:list', undefined, qk.officials.list);
export const useOfficialHistory = (id: number | null) =>
  useApiQuery('officials:history', { id: id ?? 0 }, qk.officials.history(id ?? 0), { enabled: id != null });

export const useCompetitions = () => useApiQuery('competitions:list', undefined, qk.competitions.list);
export const useCompetition = (id: number) =>
  useApiQuery('competitions:get', { id }, qk.competitions.detail(id));
export const useAssignments = (competitionId: number) =>
  useApiQuery('assignments:list', { competition_id: competitionId }, qk.assignments.list(competitionId));

export const useRoles = () => useApiQuery('roles:list', undefined, qk.roles.list);
export const useDisciplines = () => useApiQuery('disciplines:list', undefined, qk.disciplines.list);
export const useConfig = () => useApiQuery('config:get', undefined, qk.config);
export const usePrefs = () => useApiQuery('prefs:get', undefined, qk.prefs);

export const useDashboardStats = (year?: number) =>
  useApiQuery('dashboard:stats', year ? { year } : undefined, qk.dashboard.stats(year));
export const useOwedByOfficial = () => useApiQuery('dashboard:owedByOfficial', undefined, qk.dashboard.owed);

export const useUsers = () => useApiQuery('users:list', undefined, qk.users.list);

/**
 * Excel export mutation: the channel opens the native save dialog in main and
 * returns { saved }. Shows a success toast with the file path (nothing on cancel).
 */
export function useExcelExport<C extends 'excel:officials' | 'excel:competitions' | 'excel:payments' | 'excel:competitionReport' | 'excel:summary' | 'excel:preview'>(
  channel: C,
) {
  return useApiMutation(channel, {
    onSuccess: (res) => {
      const r = res as SaveFileResult;
      if (r.saved) toast.success('Datoteka shranjena', { description: r.filePath });
    },
  });
}

export const usePayments = (filter?: PaymentFilter) =>
  useApiQuery('payments:list', filter, qk.payments.list(filter), { placeholderData: (prev) => prev });
export const usePayment = (id: number | null) =>
  useApiQuery('payments:get', { id: id ?? 0 }, qk.payments.detail(id ?? 0), { enabled: id != null });
