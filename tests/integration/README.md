# Integration tests

These run the real main-process handlers (validation, repos, error mapping,
Excel) against a **local** PostgREST stack that holds a restored copy of the
production data. Electron is replaced by `electron-stub.ts`, and the generated
`API_URL` by `api-config.ts`, which refuses any host except `127.0.0.1` /
`localhost`. `npm run test` (unit tests) never needs the stack.

## Run

Start the stack (see DEPLOYMENT.md section 8 and `deploy/scripts/restore-dump.sh`),
then export the API URL (nginx with the `/rest/v1` prefix, default
`http://127.0.0.1:8082`) and two local-only users, one admin and one read-only:

```sh
export ZAS_TEST_API_URL=http://127.0.0.1:8082
export PARITY_ADMIN_USER=... PARITY_ADMIN_PASSWORD=...
export PARITY_USER_USER=...  PARITY_USER_PASSWORD=...
npm run test:integration
```

Optionally `ZAS_PARITY_OUT=parity/new/excel` also writes the D1-D6 files that
`node scripts/xlsx-compare.js parity/baseline/excel parity/new/excel --unordered-rows`
compares with the M0 baseline.

## Data safety

- `dashboard.int.test.ts` is read-only and asserts the numbers of the
  **unmodified** restore (owed 1518.42, paid 2025 = 2689.02). Restore the copy
  with `deploy/scripts/restore-dump.sh` first if other work changed it.
- `money.int.test.ts` and `excel.int.test.ts` create their own records (names
  start with `ITEST`: competitions, officials, a role, assignments, payments,
  installments) and delete them in `afterAll`, in dependency order. Table
  digests before and after a run are identical (only identity sequences move).
  If a run is killed half-way, delete leftovers with
  `DELETE ... WHERE name LIKE 'ITEST%'` or simply restore the copy.
- Nothing here ever calls `config:clearAllData` as an admin (it is only
  asserted to be FORBIDDEN for the read-only user).
