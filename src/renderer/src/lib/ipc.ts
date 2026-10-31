import type { ChannelInput, ChannelName, ChannelOutput, InvokeArgs, IpcError } from '@shared/ipc';

/** Thrown by `call` when the main process answers with an error Result. */
export class IpcCallError extends Error {
  constructor(readonly error: IpcError) {
    super(error.message);
    this.name = 'IpcCallError';
  }
  get code() {
    return this.error.code;
  }
}

/** Typed invoke that unwraps Result<T> and throws IpcCallError on failure (for TanStack Query). */
export async function call<C extends ChannelName>(
  channel: C,
  ...input: InvokeArgs<ChannelInput<C>>
): Promise<ChannelOutput<C>> {
  const res = await window.api.invoke(channel, ...input);
  if (!res.ok) throw new IpcCallError(res.error);
  return res.data;
}
