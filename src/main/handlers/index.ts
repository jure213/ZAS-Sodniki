import { registerAssignmentHandlers } from './assignments';
import { registerCompetitionHandlers } from './competitions';
import { registerConfigHandlers } from './config';
import { registerDashboardHandlers } from './dashboard';
import { registerExcelHandlers } from './excel';
import { registerOfficialHandlers } from './officials';
import { registerPaymentHandlers } from './payments';
import { registerUserHandlers } from './users';

/** Every data channel (everything except auth, app, prefs and the updater). */
export function registerDataHandlers(): void {
  registerOfficialHandlers();
  registerCompetitionHandlers();
  registerAssignmentHandlers();
  registerConfigHandlers();
  registerPaymentHandlers();
  registerDashboardHandlers();
  registerUserHandlers();
  registerExcelHandlers();
}
