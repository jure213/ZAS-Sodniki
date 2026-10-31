// Integration tests: the real main-process handlers against a LOCAL stack
// (see tests/integration/README.md). Electron is replaced by a stub and the
// generated API URL by the test stack, so production can never be reached.
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const here = __dirname;

export default defineConfig({
  resolve: {
    alias: [
      { find: '@shared', replacement: resolve(here, 'src/shared') },
      { find: /^electron$/, replacement: resolve(here, 'tests/integration/electron-stub.ts') },
      { find: /^.*\/generated\/api-config$/, replacement: resolve(here, 'tests/integration/api-config.ts') },
    ],
  },
  test: {
    include: ['tests/integration/**/*.int.test.ts'],
    environment: 'node',
    // One shared database: files and tests run one after another.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
