// User writes go through SQL functions: passwords are hashed in the database
// and admins can never read or write password hashes directly.
import type { UserRow } from '@shared/types';
import { db, unwrap } from './client';
import { text, type Row } from './rows';

export async function listUsers(): Promise<UserRow[]> {
  const rows = unwrap(
    await db.rest.from('users').select('id, username, name, role, created_at').order('username'),
  ) as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    username: text(r.username),
    name: text(r.name),
    role: text(r.role),
    created_at: text(r.created_at),
  }));
}

export async function createUser(input: {
  username: string;
  password: string;
  name: string;
  role: string;
}): Promise<number> {
  return Number(unwrap(await db.rest.rpc('create_user', input)));
}

export async function updateUser(
  id: number,
  input: { username: string; name: string; role: string; password?: string },
): Promise<void> {
  unwrap(await db.rest.rpc('update_user', { id, ...input, password: input.password || null }));
}

export async function deleteUser(id: number): Promise<void> {
  unwrap(await db.rest.rpc('delete_user', { id }));
}
