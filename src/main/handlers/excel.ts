import { excelCompetitionInput, excelSummaryInput, paymentFilterSchema } from '@shared/schemas';
import { AppError } from '../ipc/errors';
import { handle } from '../ipc/handle';
import { listCompetitions } from '../db/competitions.repo';
import { listOfficials } from '../db/officials.repo';
import { listPayments } from '../db/payments.repo';
import { buildCompetitionReport } from '../excel/competitionReport';
import { buildCompetitions } from '../excel/competitions';
import { loadCompetitionReport, loadPreview, loadSummary } from '../excel/data';
import {
  COMPETITIONS_FILE,
  OFFICIALS_FILE,
  competitionReportName,
  paymentsName,
  previewName,
  summaryName,
} from '../excel/fileNames';
import { buildOfficials } from '../excel/officials';
import { buildPayments } from '../excel/payments';
import { buildPreview } from '../excel/preview';
import { saveWorkbook } from '../excel/save';
import { buildSummary } from '../excel/summary';

export function registerExcelHandlers(): void {
  handle('excel:competitionReport', excelCompetitionInput, async ({ competition_id, tariff }) => {
    const data = await loadCompetitionReport(competition_id, tariff);
    return saveWorkbook(
      buildCompetitionReport(data),
      'Shrani Excel poročilo',
      competitionReportName(data.competition, tariff),
    );
  });

  handle('excel:summary', excelSummaryInput, async ({ competition_ids, tariff }) => {
    const rows = await loadSummary(competition_ids, tariff);
    if (rows.length === 0) throw new AppError('VALIDATION', 'Ni podatkov za izbrane tekme');
    return saveWorkbook(buildSummary(rows), 'Shrani pregled tekem', summaryName(tariff));
  });

  handle('excel:summaryData', excelSummaryInput, ({ competition_ids, tariff }) =>
    loadSummary(competition_ids, tariff),
  );

  handle('excel:preview', excelCompetitionInput, async ({ competition_id, tariff }) => {
    const data = await loadPreview(competition_id, tariff);
    return saveWorkbook(buildPreview(data), 'Shrani predogled izplačil', previewName(data.competition));
  });

  handle('excel:officials', null, async () => {
    const officials = await listOfficials();
    if (officials.length === 0) throw new AppError('VALIDATION', 'Ni sodnikov za izvoz');
    return saveWorkbook(buildOfficials(officials), 'Shrani seznam sodnikov', OFFICIALS_FILE);
  });

  handle('excel:competitions', null, async () => {
    const competitions = await listCompetitions();
    if (competitions.length === 0) throw new AppError('VALIDATION', 'Ni tekmovanj za izvoz');
    return saveWorkbook(buildCompetitions(competitions), 'Shrani seznam tekmovanj', COMPETITIONS_FILE);
  });

  handle('excel:payments', paymentFilterSchema.optional(), async (filter) => {
    const payments = await listPayments(filter);
    if (payments.length === 0) throw new AppError('VALIDATION', 'Ni podatkov za izvoz');
    return saveWorkbook(buildPayments(payments), 'Shrani seznam izplačil', paymentsName());
  });
}
