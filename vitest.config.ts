import path from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = path.resolve(__dirname);

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@": path.resolve(rootDir, "apps/server/src"),
          },
        },
        test: {
          name: "server",
          root: path.resolve(rootDir, "apps/server"),
          environment: "node",
          include: ["src/**/*.test.ts"],
          coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            reportsDirectory: path.resolve(rootDir, "coverage/server"),
          },
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(rootDir, "apps/web/src"),
          },
        },
        test: {
          name: "web",
          root: path.resolve(rootDir, "apps/web"),
          environment: "jsdom",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          setupFiles: [path.resolve(rootDir, "apps/web/src/test/setup.ts")],
          coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            reportsDirectory: path.resolve(rootDir, "coverage/web"),
          },
        },
      },
      {
        test: {
          name: "env",
          root: path.resolve(rootDir, "packages/env"),
          environment: "node",
          include: ["src/**/*.test.ts"],
          coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            reportsDirectory: path.resolve(rootDir, "coverage/env"),
          },
        },
      },
    ],
  },
});
