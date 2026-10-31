// Calendar dates are plain "YYYY-MM-DD" strings. Never go through
// new Date('YYYY-MM-DD'): that parses as UTC midnight and shifts the day in
// timezones west of UTC (when formatted in local time).

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

export type YMD = { year: number; month: number; day: number };

export function parseIsoDate(iso: string): YMD | null {
  const m = ISO.exec(iso ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > dim) return null;
  return { year, month, day };
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** "2025-03-07" -> "07.03.2025". Returns '' for empty and the input for unparsable text. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseIsoDate(iso);
  return d ? `${p2(d.day)}.${p2(d.month)}.${d.year}` : iso;
}

/** "07.03.2025" or "7. 3. 2025" -> "2025-03-07", or null when invalid. */
export function parseDisplayDate(text: string): string | null {
  const m = /^\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})\s*$/.exec(text);
  if (!m) return null;
  const iso = `${m[3]}-${p2(Number(m[2]))}-${p2(Number(m[1]))}`;
  return parseIsoDate(iso) ? iso : null;
}

/** Local-time Date to "YYYY-MM-DD" (no UTC conversion). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Today's local date as "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Year of an ISO date string, or null. */
export function isoYear(iso: string): number | null {
  return parseIsoDate(iso)?.year ?? null;
}

/** Local-midnight Date for an ISO date (for pickers). Never UTC. */
export function isoToLocalDate(iso: string): Date | null {
  const d = parseIsoDate(iso);
  return d ? new Date(d.year, d.month - 1, d.day) : null;
}
