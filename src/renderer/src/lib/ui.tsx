// Small presentational helpers shared by the money-heavy pages.

import { formatCents } from '@shared/money';

/** Right-aligned-friendly money cell: "1.234,56 €" with tabular figures. */
export const money = (cents: number) => <span className="tabular-nums">{formatCents(cents)}</span>;

export const sumBy = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/** 4 -> "4", 2.5 -> "2,5" */
export const num = (n: number) => String(n).replace('.', ',');

export const dash = (v: string | null | undefined) => v || <span className="text-muted-foreground/60">–</span>;

/** Parse a decimal typed with comma or dot; null when empty/invalid. */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
