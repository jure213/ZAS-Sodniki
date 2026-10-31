#!/usr/bin/env node

// Creates the server .env for a brand-new deployment. To rotate only the JWT
// secret on an existing server use deploy/scripts/rotate-jwt-secret.sh.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const force = process.argv.includes("--force");

if (fs.existsSync(envPath) && !force) {
  console.error(".env already exists. Refusing to overwrite it (use --force only for a brand-new server).\n");
  process.exit(1);
}

const env = [
  "COMPOSE_PROJECT_NAME=zas-sodniki",
  `POSTGRES_PASSWORD=${crypto.randomBytes(32).toString("hex")}`,
  `POSTGREST_DB_PASSWORD=${crypto.randomBytes(32).toString("hex")}`,
  `PGRST_JWT_SECRET=${crypto.randomBytes(48).toString("base64url")}`,
  "ZAS_API_URL=https://sodniki-api.jurer.eu",
  "",
].join("\n");

fs.writeFileSync(envPath, env, { mode: 0o600, flag: force ? "w" : "wx" });
fs.chmodSync(envPath, 0o600);
console.log(`Generated ${envPath} with mode 0600.`);
