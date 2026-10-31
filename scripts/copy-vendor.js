#!/usr/bin/env node

// Copies the third-party UI assets into src/vendor so the app loads nothing
// from the internet (see the Content-Security-Policy in src/index.html).
// Versions are pinned exactly in package.json devDependencies.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vendorDir = path.join(root, "src", "vendor");

const files = [
  ["node_modules/bootstrap/dist/css/bootstrap.min.css", "bootstrap/bootstrap.min.css"],
  ["node_modules/bootstrap/dist/js/bootstrap.bundle.min.js", "bootstrap/bootstrap.bundle.min.js"],
  ["node_modules/bootstrap-icons/font/bootstrap-icons.min.css", "bootstrap-icons/bootstrap-icons.min.css"],
  ["node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2", "bootstrap-icons/fonts/bootstrap-icons.woff2"],
  ["node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff", "bootstrap-icons/fonts/bootstrap-icons.woff"],
];

fs.rmSync(vendorDir, { recursive: true, force: true });
for (const [from, to] of files) {
  const source = path.join(root, from);
  if (!fs.existsSync(source)) {
    console.error(`Missing ${from}. Run npm install.`);
    process.exit(1);
  }
  const target = path.join(vendorDir, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // Drop sourceMappingURL comments: the .map files are not shipped.
  if (to.endsWith(".css") || to.endsWith(".js")) {
    const text = fs.readFileSync(source, "utf8").replace(/\n?\/[*/]# sourceMappingURL=.*$/m, "");
    fs.writeFileSync(target, text);
  } else {
    fs.copyFileSync(source, target);
  }
}
console.log(`Copied ${files.length} vendor files to src/vendor.`);
