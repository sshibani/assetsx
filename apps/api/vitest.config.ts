import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    fileParallelism: false,
    server: {
      deps: {
        external: ["sharp", "argon2", "@prisma/client", "file-type"],
      },
    },
  },
});
