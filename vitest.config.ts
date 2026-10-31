import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@shared', replacement: resolve(__dirname, 'src/shared') },
      // The real file is generated and gitignored; unit tests never need it.
      { find: /^.*\/generated\/api-config$/, replacement: resolve(__dirname, 'tests/integration/api-config.ts') },
    ],
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
