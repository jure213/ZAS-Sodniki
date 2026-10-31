import {
  appConfigSchema,
  clearAllDataInput,
  disciplineNameInput,
  disciplineReorderInput,
  disciplineUpdateInput,
  idInput,
  roleSaveInput,
} from '@shared/schemas';
import * as config from '../db/config.repo';
import { handle } from '../ipc/handle';

export function registerConfigHandlers(): void {
  handle('roles:list', null, () => config.listRoles());
  handle('roles:save', roleSaveInput, async (input) => ({ id: await config.saveRole(input) }));
  handle('roles:delete', idInput, async ({ id }) => ({ result: await config.deleteRole(id) }));
  handle('roles:usage', idInput, ({ id }) => config.roleUsage(id));

  handle('disciplines:list', null, () => config.listDisciplines());
  handle('disciplines:add', disciplineNameInput, ({ name }) => config.addDiscipline(name));
  handle('disciplines:update', disciplineUpdateInput, ({ id, name, archived }) =>
    config.updateDiscipline(id, { name, archived }),
  );
  handle('disciplines:delete', idInput, async ({ id }) => ({ result: await config.deleteDiscipline(id) }));
  handle('disciplines:reorder', disciplineReorderInput, async ({ ids }) => {
    await config.reorderDisciplines(ids);
    return null;
  });
  handle('disciplines:usage', idInput, ({ id }) => config.disciplineUsage(id));

  handle('config:get', null, () => config.getConfig());
  handle('config:update', appConfigSchema, (input) => config.updateConfig(input));
  handle('config:clearAllData', clearAllDataInput, async () => {
    await config.clearAllData();
    return null;
  });
}
