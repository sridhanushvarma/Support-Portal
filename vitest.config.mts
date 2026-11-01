import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const alias = {
  "@": path.resolve(__dirname, "src"),
  "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
};

export default defineConfig({
  test: {
    // Integration tests share one database, so files run sequentially.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/setup/unit-env.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/setup/integration-env.ts"],
          globalSetup: ["tests/setup/integration-global.ts"],
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
