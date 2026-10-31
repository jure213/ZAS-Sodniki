#!/usr/bin/env node
// Structural diff of .xlsx files: sheet names, merged ranges, column widths,
// row heights, cell values, number formats, fonts, borders, alignment, fills.
//
//   node scripts/xlsx-compare.js <expected.xlsx|dir> <actual.xlsx|dir> [--json out.json] [--only D1,D2] [--unordered-rows]
//
// --unordered-rows compares the data rows of D1-D6 as a set (v1 did not order
// them), still comparing every style position by position.
//
// With two directories, files with the same name are compared and files that
// exist on one side only are reported. Exit code 1 when there are differences.
// The output can contain personal data: keep reports under parity/.
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const EPS = 1e-9;

function norm(v) {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v, Object.keys(v).sort());
  return v;
}

const same = (a, b) =>
  typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < EPS : a === b;

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function styleParts(cell) {
  const f = cell.font || {};
  const a = cell.alignment || {};
  const fill = cell.fill || {};
  const b = cell.border || {};
  const side = (s) => (s && s.style ? `${s.style}${s.color ? JSON.stringify(s.color) : ""}` : null);
  return {
    numFmt: cell.numFmt || null,
    "font.bold": !!f.bold,
    "font.size": f.size ?? null,
    "font.name": f.name ?? null,
    "font.italic": !!f.italic,
    "font.color": f.color ? JSON.stringify(f.color) : null,
    "align.horizontal": a.horizontal ?? null,
    "align.vertical": a.vertical ?? null,
    "align.wrap": !!a.wrapText,
    "fill": fill.type ? JSON.stringify(pick(fill, ["type", "pattern", "fgColor", "bgColor"])) : null,
    "border.top": side(b.top),
    "border.left": side(b.left),
    "border.bottom": side(b.bottom),
    "border.right": side(b.right),
  };
}

function sheetMeta(ws) {
  const cols = [];
  const maxCol = Math.max(ws.columnCount, ws.actualColumnCount || 0);
  for (let c = 1; c <= maxCol; c++) cols.push(ws.getColumn(c).width ?? null);
  const heights = [];
  for (let r = 1; r <= ws.rowCount; r++) heights.push(ws.getRow(r).height ?? null);
  const merges = Object.keys((ws.model && ws.model.merges) || {}).length
    ? Object.keys(ws.model.merges)
    : Array.isArray(ws.model && ws.model.merges)
      ? ws.model.merges
      : [];
  return { cols, heights, merges: [...merges].sort(), rows: ws.rowCount, columns: maxCol };
}

// Data rows per export (1-based first row, rows after the data such as totals).
const REGIONS = { D1: [3, 1], D2: [3, 1], D3: [3, 1], D4: [4, 0], D5: [4, 0], D6: [3, 2] };

function regionFor(file, unordered) {
  if (!unordered) return null;
  const key = Object.keys(REGIONS).find((k) => file.startsWith(k));
  return key ? REGIONS[key] : null;
}

function compareSheets(name, a, b, diffs, region) {
  const ma = sheetMeta(a);
  const mb = sheetMeta(b);
  const d = (what, x, y) => diffs.push({ where: `${name}`, what, expected: x, actual: y });

  if (ma.rows !== mb.rows) d("row count", ma.rows, mb.rows);
  if (ma.columns !== mb.columns) d("column count", ma.columns, mb.columns);
  if (JSON.stringify(ma.merges) !== JSON.stringify(mb.merges)) d("merged ranges", ma.merges, mb.merges);
  for (let i = 0; i < Math.max(ma.cols.length, mb.cols.length); i++) {
    if (!same(ma.cols[i] ?? null, mb.cols[i] ?? null)) d(`column ${i + 1} width`, ma.cols[i] ?? null, mb.cols[i] ?? null);
  }
  for (let i = 0; i < Math.max(ma.heights.length, mb.heights.length); i++) {
    if (!same(ma.heights[i] ?? null, mb.heights[i] ?? null)) d(`row ${i + 1} height`, ma.heights[i] ?? null, mb.heights[i] ?? null);
  }

  const rows = Math.max(ma.rows, mb.rows);
  const cols = Math.max(ma.columns, mb.columns);
  const inRegion = (r) => region && ma.rows === mb.rows && r >= region[0] && r <= ma.rows - region[1];
  if (region && ma.rows === mb.rows) {
    const sig = (ws, r) => JSON.stringify(Array.from({ length: cols }, (_, i) => norm(ws.getRow(r).getCell(i + 1).value)));
    const count = new Map();
    for (let r = region[0]; r <= ma.rows - region[1]; r++) {
      count.set(sig(a, r), (count.get(sig(a, r)) || 0) + 1);
      count.set(sig(b, r), (count.get(sig(b, r)) || 0) - 1);
    }
    for (const [k, n] of count) {
      if (n > 0) diffs.push({ where: name, what: "row only in expected", expected: JSON.parse(k), actual: null });
      if (n < 0) diffs.push({ where: name, what: "row only in actual", expected: null, actual: JSON.parse(k) });
    }
  }
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const ca = a.getRow(r).getCell(c);
      const cb = b.getRow(r).getCell(c);
      const ref = ca.address;
      const va = norm(ca.value);
      const vb = norm(cb.value);
      // An absent cell and an empty-string cell look the same in Excel.
      const blank = (v) => v === null || v === "";
      if (!inRegion(r) && !(blank(va) && blank(vb)) && !same(va, vb)) diffs.push({ where: `${name}!${ref}`, what: "value", expected: va, actual: vb });
      // Styles only matter for cells that have content or a border/fill.
      const sa = styleParts(ca);
      const sb = styleParts(cb);
      for (const k of Object.keys(sa)) {
        if (!same(sa[k], sb[k])) diffs.push({ where: `${name}!${ref}`, what: k, expected: sa[k], actual: sb[k] });
      }
    }
  }
}

async function compareFiles(expectedPath, actualPath, unordered = false) {
  const wa = new ExcelJS.Workbook();
  const wb = new ExcelJS.Workbook();
  await wa.xlsx.readFile(expectedPath);
  await wb.xlsx.readFile(actualPath);
  const diffs = [];
  const na = wa.worksheets.map((w) => w.name);
  const nb = wb.worksheets.map((w) => w.name);
  if (JSON.stringify(na) !== JSON.stringify(nb)) diffs.push({ where: "workbook", what: "sheet names", expected: na, actual: nb });
  for (const w of wa.worksheets) {
    const other = wb.getWorksheet(w.name);
    if (other) compareSheets(w.name, w, other, diffs, regionFor(path.basename(expectedPath), unordered));
  }
  return diffs;
}

function listXlsx(dir) {
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xlsx")).sort();
}

async function compareDirs(expectedDir, actualDir, only, unordered = false) {
  const ea = listXlsx(expectedDir);
  const eb = new Set(listXlsx(actualDir));
  const result = [];
  for (const f of ea) {
    if (only && !only.some((p) => f.startsWith(p))) continue;
    if (!eb.has(f)) {
      result.push({ file: f, missing: "actual", diffs: [] });
      continue;
    }
    result.push({ file: f, diffs: await compareFiles(path.join(expectedDir, f), path.join(actualDir, f), unordered) });
    eb.delete(f);
  }
  for (const f of eb) if (!only || only.some((p) => f.startsWith(p))) result.push({ file: f, missing: "expected", diffs: [] });
  return result;
}

module.exports = { compareFiles, compareDirs };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const flag = (name) => {
      const i = args.indexOf(name);
      if (i < 0) return null;
      const v = args[i + 1];
      args.splice(i, 2);
      return v;
    };
    const unordered = args.includes("--unordered-rows");
    if (unordered) args.splice(args.indexOf("--unordered-rows"), 1);
    const jsonOut = flag("--json");
    const only = flag("--only");
    const [expected, actual] = args;
    if (!expected || !actual) {
      console.error("usage: xlsx-compare.js <expected.xlsx|dir> <actual.xlsx|dir> [--json out.json] [--only D1,D2]");
      process.exit(2);
    }
    const results = fs.statSync(expected).isDirectory()
      ? await compareDirs(expected, actual, only ? only.split(",") : null, unordered)
      : [{ file: path.basename(expected), diffs: await compareFiles(expected, actual, unordered) }];

    let bad = 0;
    for (const r of results) {
      const status = r.missing ? `MISSING in ${r.missing}` : r.diffs.length === 0 ? "identical" : `${r.diffs.length} difference(s)`;
      if (r.missing || r.diffs.length) bad++;
      console.log(`${r.file}: ${status}`);
      for (const d of r.diffs.slice(0, 15)) console.log(`    ${d.where} ${d.what}: ${JSON.stringify(d.expected)} -> ${JSON.stringify(d.actual)}`);
      if (r.diffs.length > 15) console.log(`    ... ${r.diffs.length - 15} more`);
    }
    console.log(`\n${results.length} file(s), ${bad} with differences`);
    if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 1));
    process.exit(bad ? 1 : 0);
  })().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
