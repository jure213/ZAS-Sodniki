// Replaces src/main/generated/api-config.ts in integration tests. Only a local
// PostgREST (through the nginx /rest/v1 prefix) is accepted.
const url = process.env.ZAS_TEST_API_URL ?? 'http://127.0.0.1:8082';
const host = new URL(url).hostname;
if (host !== '127.0.0.1' && host !== 'localhost') {
  throw new Error(`Integration tests refuse to run against ${host}: use a local stack`);
}
export const API_URL = url;
