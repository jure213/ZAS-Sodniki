import { dashboardInput } from '@shared/schemas';
import * as dashboard from '../db/dashboard.repo';
import { handle } from '../ipc/handle';

export function registerDashboardHandlers(): void {
  handle('dashboard:stats', dashboardInput.optional(), (input) => dashboard.dashboardStats(input?.year));
  handle('dashboard:owedByOfficial', null, () => dashboard.owedByOfficial());
}
