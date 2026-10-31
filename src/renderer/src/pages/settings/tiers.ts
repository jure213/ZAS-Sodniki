// Tier editing helpers (client-side validation mirrors the tariff rules:
// a tier matches hours > from && hours <= to; empty "to" = no upper limit).

import type { Tier } from '@shared/tariff';

/** Editable tier row: from/to are text so the field can be empty (to = ∞). */
export type TierRow = { key: number; from: string; to: string; rate: number | null };

let nextKey = 1;
const fmt = (n: number) => String(n).replace('.', ',');
export const parseHours = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function toRows(tiers: Tier[]): TierRow[] {
  return tiers.map((t) => ({
    key: nextKey++,
    from: fmt(t.from),
    to: t.to == null || t.to >= 999 ? '' : fmt(t.to),
    rate: Math.round(t.rate * 100),
  }));
}

export function newRow(prev?: TierRow): TierRow {
  const to = prev ? parseHours(prev.to) : null;
  return { key: nextKey++, from: to != null ? fmt(to) : prev ? '' : '0', to: '', rate: null };
}

/**
 * Rows after "Dodaj razpon": when the last tier is unbounded (empty "Do") it gets a
 * sensible upper limit (its "Od" + 2 hours) so the new tier starts right where it ends
 * and no overlap error appears immediately.
 */
export function appendRow(rows: TierRow[]): TierRow[] {
  const last = rows[rows.length - 1];
  if (!last) return [newRow()];
  const from = parseHours(last.from);
  if (last.to.trim() === '' && from != null) {
    const closed = { ...last, to: fmt(from + 2) };
    return [...rows.slice(0, -1), closed, newRow(closed)];
  }
  return [...rows, newRow(last)];
}

export type TierProblems = { rows: Record<number, string>; general: string[] };

/** Returns an error message per row (by key) and general messages (gaps / overlaps). */
export function validateTiers(rows: TierRow[]): TierProblems {
  const out: TierProblems = { rows: {}, general: [] };
  const parsed = rows.map((r) => ({ r, from: parseHours(r.from), to: parseHours(r.to), toEmpty: r.to.trim() === '' }));
  for (const p of parsed) {
    if (p.from == null || p.from < 0) out.rows[p.r.key] = 'Vnesite veljaven začetek';
    else if (!p.toEmpty && (p.to == null || p.to <= p.from)) out.rows[p.r.key] = 'Zgornja meja mora biti večja od začetka';
    else if (p.r.rate == null) out.rows[p.r.key] = 'Vnesite znesek';
  }
  if (Object.keys(out.rows).length) return out;
  const sorted = [...parsed].sort((a, b) => a.from! - b.from!);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a.toEmpty || a.to! > b.from!) {
      out.general.push(`Razponi se prekrivajo (${fmt(a.from!)}–${a.toEmpty ? '∞' : fmt(a.to!)} in ${fmt(b.from!)}–${b.toEmpty ? '∞' : fmt(b.to!)}).`);
    } else if (a.to! < b.from!) {
      out.general.push(`Vrzel med ${fmt(a.to!)} in ${fmt(b.from!)} ur – za te ure znesek ni določen.`);
    }
  }
  return out;
}

export function rowsToTiers(rows: TierRow[]): Tier[] {
  return rows.map((r) => ({ from: parseHours(r.from)!, to: parseHours(r.to), rate: (r.rate ?? 0) / 100 }));
}

/** Short human summary for the roles list, e.g. "0–2 h: 15,00 €". */
export function summarize(tiers: Tier[]): string[] {
  return tiers.map((t) => {
    const to = t.to == null || t.to >= 999 ? '∞' : fmt(t.to);
    return `${fmt(t.from)}–${to} h: ${t.rate.toFixed(2).replace('.', ',')} €`;
  });
}
