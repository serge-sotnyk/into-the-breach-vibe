import { defineConfig } from 'vitest/config';

// Opt-in balance report: plays many battles with the auto-pilot and prints win rates / grid loss.
export default defineConfig({
  test: { include: ['tests/**/*.balance.ts'], environment: 'node', testTimeout: 600000, silent: false },
});
