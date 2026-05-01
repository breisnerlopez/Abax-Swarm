import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    root: ".",
    testTimeout: 15000,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/cli/app.ts", "src/cli/wizard.tsx", "src/cli/WizardApp.tsx", "src/cli/format.ts"],
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
