import {
  assignmentBulkInput,
  assignmentPreviewInput,
  assignmentSaveInput,
  competitionIdInput,
  idInput,
} from '@shared/schemas';
import * as assignments from '../db/assignments.repo';
import { handle } from '../ipc/handle';

export function registerAssignmentHandlers(): void {
  handle('assignments:list', competitionIdInput, ({ competition_id }) => assignments.listAssignments(competition_id));
  handle('assignments:save', assignmentSaveInput, (input) => assignments.saveAssignment(input));
  handle('assignments:preview', assignmentPreviewInput, (input) => assignments.previewAssignment(input));
  handle('assignments:bulkAdd', assignmentBulkInput, ({ competition_id, items }) =>
    assignments.bulkAddAssignments(competition_id, items),
  );
  handle('assignments:recalculate', competitionIdInput, async ({ competition_id }) => ({
    updated: await assignments.recalculateCompetition(competition_id),
  }));
  handle('assignments:delete', idInput, async ({ id }) => {
    await assignments.deleteAssignment(id);
    return null;
  });
}
