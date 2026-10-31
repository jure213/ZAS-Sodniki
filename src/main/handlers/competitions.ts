import { competitionSchema, competitionUpdateInput, idInput } from '@shared/schemas';
import * as competitions from '../db/competitions.repo';
import { handle } from '../ipc/handle';

export function registerCompetitionHandlers(): void {
  handle('competitions:list', null, () => competitions.listCompetitions());
  handle('competitions:get', idInput, ({ id }) => competitions.getCompetition(id));
  handle('competitions:create', competitionSchema, (input) => competitions.createCompetition(input));
  handle('competitions:update', competitionUpdateInput, ({ id, data }) => competitions.updateCompetition(id, data));
  handle('competitions:delete', idInput, async ({ id }) => {
    await competitions.deleteCompetition(id);
    return null;
  });
}
