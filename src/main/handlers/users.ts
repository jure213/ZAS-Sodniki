import { idInput, userCreateSchema, userUpdateInput } from '@shared/schemas';
import * as users from '../db/users.repo';
import { handle } from '../ipc/handle';

// Permissions are enforced by the database: only admins may list users or call
// the user functions; others get FORBIDDEN.
export function registerUserHandlers(): void {
  handle('users:list', null, () => users.listUsers());
  handle('users:create', userCreateSchema, async (input) => ({ id: await users.createUser(input) }));
  handle('users:update', userUpdateInput, async ({ id, data }) => {
    await users.updateUser(id, data);
    return null;
  });
  handle('users:delete', idInput, async ({ id }) => {
    await users.deleteUser(id);
    return null;
  });
}
