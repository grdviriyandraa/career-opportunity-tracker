import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Each database suite starts its own WASM PostgreSQL instance.
    // Keep the standard npm test command within small CI runner resources.
    maxWorkers: 1,
    testTimeout: 30000,
    // WASM PostgreSQL startup can exceed 10s on shared cloud CPUs.
    hookTimeout: 30000,
  },
});
