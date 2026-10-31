// Officials import from .xlsx: header detection, tolerant cell reading, and a
// preview that separates new rows, duplicates and errors. Pure (no Electron,
// no database): the caller passes the names that already exist.
import ExcelJS from 'exceljs';
import { officialSchema } from '@shared/schemas';
import type { ImportCandidate, ImportPreview } from '@shared/types';
import { AppError } from '../ipc/errors';

export const MAX_IMPORT_ROWS = 2000;
const HEADER_SEARCH_ROWS = 5;

type Field = 'name' | 'email' | 'phone' | 'rank' | 'additional_exams';

// Column names accepted by v1 (Slovenian and English, any case). Compared after
// stripping spaces, dots, dashes and underscores.
const ALIASES: Record<Field, string[]> = {
  name: ['name', 'ime'],
  email: ['email', 'e-mail'],
  phone: ['phone', 'telefon'],
  rank: ['rank', 'rang'],
  additional_exams: ['additional exams', 'dodatni izpiti', 'additional_exams', 'dodatni_izpiti'],
};

const squash = (s: string) => s.toLowerCase().replace(/[\s._-]+/g, '');

const FIELD_BY_HEADER = new Map<string, Field>(
  (Object.entries(ALIASES) as [Field, string[]][]).flatMap(([field, names]) =>
    names.map((n) => [squash(n), field] as [string, Field]),
  ),
);

/** Case-insensitive, whitespace-collapsed key used to detect duplicate names. */
export const nameKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Text of any cell: plain values, numbers, dates, hyperlinks ({text, hyperlink}),
 * formulas ({formula, result}) and rich text ({richText}).
 */
export function cellText(value: ExcelJS.CellValue | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const v = value as unknown as Record<string, unknown>;
  if (Array.isArray(v.richText)) {
    return (v.richText as { text?: string }[]).map((p) => p.text ?? '').join('').trim();
  }
  if ('result' in v && v.result != null) return cellText(v.result as ExcelJS.CellValue);
  if ('text' in v && v.text != null) return cellText(v.text as ExcelJS.CellValue);
  if ('hyperlink' in v && typeof v.hyperlink === 'string') return v.hyperlink.replace(/^mailto:/i, '').trim();
  if ('error' in v) return '';
  return '';
}

function findHeader(sheet: ExcelJS.Worksheet): { rowNumber: number; columns: Map<Field, number> } | null {
  const last = Math.min(HEADER_SEARCH_ROWS, sheet.rowCount);
  for (let r = 1; r <= last; r++) {
    const columns = new Map<Field, number>();
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const field = FIELD_BY_HEADER.get(squash(cellText(cell.value)));
      if (field && !columns.has(field)) columns.set(field, col);
    });
    if (columns.has('name')) return { rowNumber: r, columns };
  }
  return null;
}

/**
 * Reads the first sheet. `existingNames` are the officials already in the
 * database (any case); rows whose name matches one of them, or an earlier row
 * of the same file, are reported as duplicates and never inserted.
 */
export function parseOfficialsSheet(
  sheet: ExcelJS.Worksheet,
  existingNames: Iterable<string>,
  fileName: string,
): ImportPreview {
  const header = findHeader(sheet);
  if (!header) {
    throw new AppError('VALIDATION', 'V datoteki ni najdene vrstice z glavo (stolpec "Ime" ali "Name").');
  }
  if (sheet.rowCount - header.rowNumber > MAX_IMPORT_ROWS) {
    throw new AppError('VALIDATION', `Datoteka ima preveč vrstic (največ ${MAX_IMPORT_ROWS}).`);
  }

  const known = new Set<string>();
  for (const n of existingNames) known.add(nameKey(n));
  const inFile = new Set<string>();

  const preview: ImportPreview = { fileName, toInsert: [], skippedDuplicates: [], errors: [] };
  const read = (row: ExcelJS.Row, field: Field) => {
    const col = header.columns.get(field);
    return col ? cellText(row.getCell(col).value) : '';
  };

  for (let r = header.rowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const candidate: ImportCandidate = {
      row: r,
      name: read(row, 'name'),
      email: read(row, 'email'),
      phone: read(row, 'phone'),
      rank: read(row, 'rank'),
      additional_exams: read(row, 'additional_exams'),
    };
    const { row: _row, ...fields } = candidate;
    if (Object.values(fields).every((v) => v === '')) continue; // blank row

    if (candidate.name === '') {
      preview.errors.push({ row: r, message: 'Manjka ime' });
      continue;
    }
    const parsed = officialSchema.safeParse({ ...fields, name: candidate.name });
    if (!parsed.success) {
      preview.errors.push({ row: r, message: parsed.error.issues[0]?.message ?? 'Neveljavni podatki' });
      continue;
    }

    const key = nameKey(candidate.name);
    if (known.has(key)) {
      preview.skippedDuplicates.push({ row: r, name: candidate.name, reason: 'database' });
    } else if (inFile.has(key)) {
      preview.skippedDuplicates.push({ row: r, name: candidate.name, reason: 'file' });
    } else {
      inFile.add(key);
      preview.toInsert.push(candidate);
    }
  }
  return preview;
}

/** Loads an .xlsx file and parses its first sheet. */
export async function readOfficialsFile(
  filePath: string,
  existingNames: Iterable<string>,
  fileName: string,
): Promise<ImportPreview> {
  if (!/\.xlsx$/i.test(filePath)) {
    throw new AppError('VALIDATION', 'Podprta je samo oblika .xlsx. Datoteko shranite kot .xlsx in poskusite znova.');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch {
    throw new AppError('VALIDATION', 'Datoteke ni mogoče prebrati. Preverite, da je veljavna .xlsx datoteka.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) throw new AppError('VALIDATION', 'Excel datoteka je prazna.');
  return parseOfficialsSheet(sheet, existingNames, fileName);
}
