const collator = new Intl.Collator('sl', { numeric: true, sensitivity: 'base' });

/** Locale-aware (Slovenian) comparison for sorting. */
export const compareText = (a: string, b: string) => collator.compare(a, b);

/** Lower-case, diacritics-insensitive form for searching ("Čeh" matches "ceh"). */
export function normalize(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}
