import { app } from 'electron';
import { prefsInput } from '@shared/schemas';
import { handle } from '../ipc/handle';
import { getPrefs, setPrefs } from '../session/prefs';

export function registerAppHandlers(): void {
  handle('app:getVersion', null, () => app.getVersion());
  handle('app:quit', null, () => {
    app.quit();
    return null;
  });
  handle('prefs:get', null, () => getPrefs());
  handle('prefs:set', prefsInput, (input) => setPrefs(input));
}
