import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    // WASM PostgreSQL startup can exceed 10s on shared cloud CPUs.
    hookTimeout: 30000,
  },
});
