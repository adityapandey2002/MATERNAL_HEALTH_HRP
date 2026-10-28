import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    hookTimeout: 240_000,
    testTimeout: 30_000,
    teardownTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@hrp/shared": path.resolve(__dirname, "../shared/dist/index.js"),
      "@hrp/shared/rules": path.resolve(__dirname, "../shared/dist/rules.js"),
      "@hrp/shared/rules.js": path.resolve(__dirname, "../shared/dist/rules.js"),
      "@hrp/shared/schemas": path.resolve(__dirname, "../shared/dist/schemas.js"),
      "@hrp/shared/schemas.js": path.resolve(__dirname, "../shared/dist/schemas.js"),
      "@hrp/shared/date-utils": path.resolve(__dirname, "../shared/dist/date-utils.js"),
      "@hrp/shared/date-utils.js": path.resolve(__dirname, "../shared/dist/date-utils.js"),
    },
  },
});
