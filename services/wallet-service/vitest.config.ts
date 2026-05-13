import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config(); // carga .env antes de que Vitest arranque los workers

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.test.ts', 'src/server.ts', 'src/jobs/**'],
    },
    fileParallelism: false,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
