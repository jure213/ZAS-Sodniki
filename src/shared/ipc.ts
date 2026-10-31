// Typed IPC contract shared by main (handlers), preload (allowlist) and
// renderer (typed calls). Type-only consumers never pull runtime code.

import type { z } from 'zod';
import type * as S from './schemas';
import type * as T from './types';

export type ErrorCode =
  | 'VALIDATION'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'IN_USE'
  | 'SESSION_EXPIRED'
  | 'NETWORK'
  | 'UNKNOWN';

export type IpcError = { code: ErrorCode; message: string };

export type Result<T> = { ok: true; data: T } | { ok: false; error: IpcError };

export type AppUser = {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'user' | (string & {});
};

export type UpdateInfo = {
  version: string;
  currentVersion?: string;
  releaseNotes?: string | { note?: string | null }[] | null;
};

export type UpdateProgress = { percent: number };

type In<T extends z.ZodType> = z.input<T>;

/** invoke channels: input and output (the success payload of Result). */
export interface IpcChannels {
  // --- session / app ---
  'auth:login': { input: { username: string; password: string; remember?: boolean }; output: AppUser };
  'auth:restoreSession': { input: void; output: AppUser | null };
  'auth:logout': { input: void; output: null };
  'prefs:get': { input: void; output: { rememberMe: boolean } };
  'prefs:set': { input: In<typeof S.prefsInput>; output: { rememberMe: boolean } };
  'app:getVersion': { input: void; output: string };
  'app:quit': { input: void; output: null };
  'updater:check': { input: void; output: { checked: boolean } };
  'updater:download': { input: void; output: null };
  'updater:install': { input: void; output: null };

  // --- officials ---
  'officials:list': { input: void; output: T.Official[] };
  'officials:create': { input: In<typeof S.officialSchema>; output: T.Official };
  'officials:update': { input: In<typeof S.officialUpdateInput>; output: T.Official };
  'officials:setActive': { input: In<typeof S.officialActiveInput>; output: null };
  'officials:delete': { input: In<typeof S.idInput>; output: null };
  'officials:history': { input: In<typeof S.idInput>; output: T.OfficialHistoryRow[] };
  /** Opens the file dialog; null when the user cancels. */
  'officials:importPreview': { input: void; output: T.ImportPreview | null };
  'officials:importConfirm': { input: In<typeof S.officialImportInput>; output: { inserted: number } };

  // --- competitions ---
  'competitions:list': { input: void; output: T.Competition[] };
  'competitions:get': { input: In<typeof S.idInput>; output: T.Competition };
  'competitions:create': { input: In<typeof S.competitionSchema>; output: T.Competition };
  'competitions:update': { input: In<typeof S.competitionUpdateInput>; output: T.Competition };
  'competitions:delete': { input: In<typeof S.idInput>; output: null };

  // --- assignments ---
  'assignments:list': { input: In<typeof S.competitionIdInput>; output: T.Assignment[] };
  'assignments:save': { input: In<typeof S.assignmentSaveInput>; output: T.Assignment };
  'assignments:preview': { input: In<typeof S.assignmentPreviewInput>; output: T.AssignmentAmounts };
  'assignments:bulkAdd': {
    input: In<typeof S.assignmentBulkInput>;
    output: { added: number; skipped_official_ids: number[] };
  };
  'assignments:recalculate': { input: In<typeof S.competitionIdInput>; output: { updated: number } };
  'assignments:delete': { input: In<typeof S.idInput>; output: null };

  // --- roles, disciplines, config ---
  'roles:list': { input: void; output: T.Role[] };
  'roles:save': { input: In<typeof S.roleSaveInput>; output: { id: number } };
  'roles:delete': { input: In<typeof S.idInput>; output: { result: 'deleted' | 'archived' } };
  'roles:usage': { input: In<typeof S.idInput>; output: T.Usage };
  'disciplines:list': { input: void; output: T.Discipline[] };
  'disciplines:add': { input: In<typeof S.disciplineNameInput>; output: T.Discipline };
  'disciplines:update': { input: In<typeof S.disciplineUpdateInput>; output: T.Discipline };
  'disciplines:delete': { input: In<typeof S.idInput>; output: { result: 'deleted' | 'archived' } };
  'disciplines:reorder': { input: In<typeof S.disciplineReorderInput>; output: null };
  'disciplines:usage': { input: In<typeof S.idInput>; output: T.Usage };
  'config:get': { input: void; output: T.AppConfig };
  'config:update': { input: In<typeof S.appConfigSchema>; output: T.AppConfig };
  /** Danger zone: deletes officials, competitions, payments and all other users. */
  'config:clearAllData': { input: In<typeof S.clearAllDataInput>; output: null };

  // --- payments ---
  'payments:list': { input: In<typeof S.paymentFilterSchema> | void; output: T.PaymentRow[] };
  'payments:get': { input: In<typeof S.idInput>; output: T.PaymentDetail };
  'payments:generate': { input: In<typeof S.generatePaymentsInput>; output: T.GenerateResult };
  'payments:record': { input: In<typeof S.recordPaymentSchema>; output: { transaction_id: number } };
  'payments:deleteTransaction': { input: In<typeof S.idInput>; output: null };
  'payments:update': { input: In<typeof S.paymentUpdateInput>; output: null };
  'payments:delete': { input: In<typeof S.idInput>; output: null };

  // --- dashboard ---
  'dashboard:stats': { input: In<typeof S.dashboardInput> | void; output: T.DashboardStats };
  'dashboard:owedByOfficial': { input: void; output: T.OwedByOfficial[] };

  // --- users (admin only; enforced by the database) ---
  'users:list': { input: void; output: T.UserRow[] };
  'users:create': { input: In<typeof S.userCreateSchema>; output: { id: number } };
  'users:update': { input: In<typeof S.userUpdateInput>; output: null };
  'users:delete': { input: In<typeof S.idInput>; output: null };

  // --- audit log (admin only; enforced by the database) ---
  'audit:list': { input: In<typeof S.auditQuery>; output: { rows: T.AuditEntry[]; total: number } };

  // --- Excel (D1-D6). Each opens the native save dialog. ---
  'excel:competitionReport': { input: In<typeof S.excelCompetitionInput>; output: T.SaveFileResult };
  'excel:summary': { input: In<typeof S.excelSummaryInput>; output: T.SaveFileResult };
  'excel:summaryData': { input: In<typeof S.excelSummaryInput>; output: T.CompetitionSummaryRow[] };
  'excel:preview': { input: In<typeof S.excelCompetitionInput>; output: T.SaveFileResult };
  'excel:officials': { input: void; output: T.SaveFileResult };
  'excel:competitions': { input: void; output: T.SaveFileResult };
  'excel:payments': { input: In<typeof S.paymentFilterSchema> | void; output: T.SaveFileResult };
}

export type ChannelName = keyof IpcChannels;
export type ChannelInput<C extends ChannelName> = IpcChannels[C]['input'];
export type ChannelOutput<C extends ChannelName> = IpcChannels[C]['output'];

/** Events pushed from main to renderer. */
export interface IpcEvents {
  'auth:expired': void;
  'updater:available': UpdateInfo;
  'updater:not-available': void;
  'updater:progress': UpdateProgress;
  'updater:downloaded': UpdateInfo;
  'updater:error': string;
}

export type EventName = keyof IpcEvents;

/** No argument for void inputs, an optional one when the input may be omitted. */
export type InvokeArgs<I> = [I] extends [void] ? [] : [void] extends [I] ? [input?: Exclude<I, void>] : [input: I];

/** What the preload script exposes as window.api. */
export interface PreloadApi {
  invoke<C extends ChannelName>(
    channel: C,
    ...input: InvokeArgs<ChannelInput<C>>
  ): Promise<Result<ChannelOutput<C>>>;
  on<E extends EventName>(event: E, callback: (payload: IpcEvents[E]) => void): () => void;
}
