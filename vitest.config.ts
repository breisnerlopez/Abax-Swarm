import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    root: ".",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/app.ts", "src/cli/prompts.ts", "src/cli/wizard.ts", "src/cli/format.ts"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@generator": path.resolve(__dirname, "src/generator"),
      "@validator": path.resolve(__dirname, "src/validator"),
      "@loader": path.resolve(__dirname, "src/loader"),
      "@cli": path.resolve(__dirname, "src/cli"),
      "@data": path.resolve(__dirname, "data"),
    },
  },
});
