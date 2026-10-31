import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import type { ChannelName, ChannelInput, ChannelOutput, Result } from '@shared/ipc';
import { isTrustedUrl } from '../security';
import { toIpcError } from './errors';

type Schema = z.ZodType | null;

function senderIsTrusted(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  return !!frame && frame === event.sender.mainFrame && isTrustedUrl(frame.url);
}

/**
 * Registers a validated, sender-checked invoke handler. The input is parsed
 * with the zod schema (pass null for channels without input), and anything the
 * handler throws is mapped to a Result error with a Slovenian message.
 */
export function handle<C extends ChannelName, S extends Schema>(
  channel: C,
  schema: S,
  fn: (
    input: S extends z.ZodType ? z.output<S> : undefined,
    event: IpcMainInvokeEvent,
  ) => Promise<ChannelOutput<C>> | ChannelOutput<C>,
): void {
  ipcMain.handle(channel, async (event, raw: ChannelInput<C>): Promise<Result<ChannelOutput<C>>> => {
    if (!senderIsTrusted(event)) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'Nimate dovoljenja za to dejanje.' } };
    }
    try {
      const input = (schema ? schema.parse(raw) : undefined) as never;
      const data = await fn(input, event);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: toIpcError(e) };
    }
  });
}
