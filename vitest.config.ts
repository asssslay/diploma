import path from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = path.resolve(__dirname);

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: path.resolve(rootDir, "coverage"),
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/test/**",
        "**/dist/**",
        "**/coverage/**",
        "**/*.config.{ts,js,mjs,cjs}",
        "apps/web/src/routeTree.gen.ts",
      ],
    },
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
        },
      },
      {
        test: {
          name: "env",
          root: path.resolve(rootDir, "packages/env"),
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
