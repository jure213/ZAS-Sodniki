import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { ChannelInput, ChannelName, ChannelOutput, InvokeArgs, Result } from '@shared/ipc';
import { db } from '../../src/main/db/client';
import { registerDataHandlers } from '../../src/main/handlers/index';
import { dialogState, handlers } from './electron-stub';

export { dialogState };

const frame = { url: pathToFileURL(resolve(__dirname, '../../src/renderer/index.html')).href };
const event = { senderFrame: frame, sender: { mainFrame: frame } };

const tokens: Partial<Record<'admin' | 'user', string>> = {};

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see tests/integration/README.md)`);
  return v;
}

/** Registers all data handlers and logs in the two local test users. */
export async function setup(): Promise<void> {
  registerDataHandlers();
  for (const [kind, u, p] of [
    ['admin', 'PARITY_ADMIN_USER', 'PARITY_ADMIN_PASSWORD'],
    ['user', 'PARITY_USER_USER', 'PARITY_USER_PASSWORD'],
  ] as const) {
    const res = await db.login(env(u), env(p), false);
    if (!res) throw new Error(`login failed for the ${kind} test user`);
    tokens[kind] = res.token;
  }
  as('admin');
}

/** Subsequent calls run with this user's token. */
export function as(kind: 'admin' | 'user'): void {
  db.setToken(tokens[kind] ?? null);
}

/** Calls a channel exactly as the renderer would, through validation and error mapping. */
export async function call<C extends ChannelName>(
  channel: C,
  ...input: InvokeArgs<ChannelInput<C>>
): Promise<Result<ChannelOutput<C>>> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for ${channel}`);
  return (await fn(event, input[0])) as Result<ChannelOutput<C>>;
}

/** Like call, but throws on an error Result. */
export async function ok<C extends ChannelName>(
  channel: C,
  ...input: InvokeArgs<ChannelInput<C>>
): Promise<ChannelOutput<C>> {
  const res = await call(channel, ...input);
  if (!res.ok) throw new Error(`${channel} failed: ${res.error.code} ${res.error.message}`);
  return res.data;
}
