// Default file names, identical to v1.
import { formatDate, todayIso } from '@shared/dates';
import type { Tariff } from '@shared/tariff';

const safe = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_');
const fileDate = (iso: string) => formatDate(iso).replace(/\./g, '-');
const tariffLabel = (t: Tariff) => (t === 'racun' ? 'racun' : 'sodniki');

export const competitionReportName = (c: { name: string; date: string }, t: Tariff) =>
  `Tekma_${safe(c.name)}_${fileDate(c.date)}_${tariffLabel(t)}.xlsx`;

export const summaryName = (t: Tariff, today = todayIso()) => `Pregled_tekem_${today}_${tariffLabel(t)}.xlsx`;

export const previewName = (c: { name: string; date: string }) => `Predogled_${safe(c.name)}_${fileDate(c.date)}.xlsx`;

export const OFFICIALS_FILE = 'sodniki.xlsx';
export const COMPETITIONS_FILE = 'tekmovanja.xlsx';
export const paymentsName = (today = todayIso()) => `Izplacila_${today}.xlsx`;
