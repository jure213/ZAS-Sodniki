import { idInput, officialActiveInput, officialImportInput, officialSchema, officialUpdateInput } from '@shared/schemas';
import * as officials from '../db/officials.repo';
import { handle } from '../ipc/handle';
import { pickOfficialsFile } from '../excel/save';
import { readOfficialsFile, nameKey } from '../excel/officialsImport';
import * as path from 'node:path';

export function registerOfficialHandlers(): void {
  handle('officials:list', null, () => officials.listOfficials());
  handle('officials:create', officialSchema, (input) => officials.createOfficial(input));
  handle('officials:update', officialUpdateInput, ({ id, data }) => officials.updateOfficial(id, data));
  handle('officials:setActive', officialActiveInput, async ({ id, active }) => {
    await officials.setOfficialActive(id, active);
    return null;
  });
  handle('officials:delete', idInput, async ({ id }) => {
    await officials.deleteOfficial(id);
    return null;
  });
  handle('officials:history', idInput, ({ id }) => officials.officialHistory(id));

  handle('officials:importPreview', null, async () => {
    const filePath = await pickOfficialsFile();
    if (!filePath) return null;
    const existing = (await officials.listOfficials()).map((o) => o.name);
    return readOfficialsFile(filePath, existing, path.basename(filePath));
  });

  // Re-checks names against the database (another user may have added some
  // since the preview), then inserts everything in one request.
  handle('officials:importConfirm', officialImportInput, async ({ rows }) => {
    const known = new Set((await officials.listOfficials()).map((o) => nameKey(o.name)));
    const fresh = rows.filter((r) => {
      const key = nameKey(r.name);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    return { inserted: await officials.insertOfficials(fresh.map((r) => ({ ...r, active: true }))) };
  });
}
