import { defineConfig } from 'vitest/config';
import baseConfig from './vite.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['contracts/**/*.contract.test.ts'],
  },
});
