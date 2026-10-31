// Typed IPC contract shared by main (handlers), preload (allowlist) and
// renderer (typed calls). Type-only consumers never pull runtime code.

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

/** invoke channels: input and output (the success payload of Result). */
export interface IpcChannels {
  'auth:login': { input: { username: string; password: string; remember?: boolean }; output: AppUser };
  'auth:restoreSession': { input: void; output: AppUser | null };
  'auth:logout': { input: void; output: null };
  'prefs:get': { input: void; output: { rememberMe: boolean } };
  'app:getVersion': { input: void; output: string };
  'app:quit': { input: void; output: null };
  'updater:check': { input: void; output: { checked: boolean } };
  'updater:download': { input: void; output: null };
  'updater:install': { input: void; output: null };
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

/** What the preload script exposes as window.api. */
export interface PreloadApi {
  invoke<C extends ChannelName>(
    channel: C,
    ...input: ChannelInput<C> extends void ? [] : [ChannelInput<C>]
  ): Promise<Result<ChannelOutput<C>>>;
  on<E extends EventName>(event: E, callback: (payload: IpcEvents[E]) => void): () => void;
}
