#!/usr/bin/env node
// Fails if the packaged app.asar contains anything that must never ship.
// Run after `electron-builder --dir` / a full build.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const candidates = [
  path.join(root, "release", "win-unpacked", "resources", "app.asar"),
  path.join(root, "release", "linux-unpacked", "resources", "app.asar"),
];
const asar = candidates.find((p) => fs.existsSync(p));
if (!asar) {
  console.error("No app.asar found under release/ (run electron-builder first).");
  process.exit(1);
}

const asarBin = require.resolve("@electron/asar/bin/asar");
const listing = execFileSync(process.execPath, [asarBin, "list", asar], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split(/\r?\n/)
  .map((l) => l.split(path.sep).join("/").split("\\").join("/"))
  .filter(Boolean);

const forbidden = [
  /^\/src\//,
  /^\/deploy\//,
  /^\/parity\//,
  /^\/scripts\//,
  /^\/\.env/,
  /\.dump(\.sha256)?$/i,
  /^\/out\/.*\.map$/i,
];
const bad = listing.filter((f) => forbidden.some((re) => re.test(f)));

if (bad.length) {
  console.error(`Forbidden files in ${path.relative(root, asar)}:`);
  for (const f of bad) console.error("  " + f);
  process.exit(1);
}
console.log(`asar check OK: ${listing.length} entries, nothing forbidden (${path.relative(root, asar)}).`);
