#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const force = process.argv.includes("--force");

if (fs.existsSync(envPath) && !force) {
  console.error(".env already exists. Refusing to overwrite it (use --force only for an intentional key rotation).\n");
  process.exit(1);
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwtSecret = crypto.randomBytes(48).toString("base64url");
const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
  role: "zas_sodniki_api",
  iss: "zas-sodniki",
  iat: Math.floor(Date.now() / 1000),
})}`;
const signature = crypto.createHmac("sha256", jwtSecret).update(signingInput).digest("base64url");
const apiKey = `${signingInput}.${signature}`;

const env = [
  "COMPOSE_PROJECT_NAME=zas-sodniki",
  `POSTGRES_PASSWORD=${crypto.randomBytes(32).toString("hex")}`,
  `POSTGREST_DB_PASSWORD=${crypto.randomBytes(32).toString("hex")}`,
  `PGRST_JWT_SECRET=${jwtSecret}`,
  "ZAS_API_URL=https://sodniki-api.jurer.eu",
  `ZAS_API_KEY=${apiKey}`,
  "",
].join("\n");

fs.writeFileSync(envPath, env, { mode: 0o600, flag: force ? "w" : "wx" });
fs.chmodSync(envPath, 0o600);
console.log(`Generated ${envPath} with mode 0600.`);
