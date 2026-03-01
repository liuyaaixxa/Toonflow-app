import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    globalSetup: ["./tests/globalSetup.ts"],
    include: ["tests/e2e/**/*.test.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "dev",
      DB_FILE: "db.test.sqlite",
      OSSURL: "http://127.0.0.1:60000/",
    },
  },
});
