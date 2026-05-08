import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@talby/workforce-domain": "./packages/domain/src/index.ts",
      "@talby/workforce-application": "./packages/application/src/index.ts"
    }
  },
  test: {
    include: ["packages/**/src/**/*.test.ts"],
    exclude: ["**/dist/**", "**/coverage/**", "**/node_modules/**"],
    coverage: {
      include: ["packages/**/src/**/*.ts"],
      exclude: [
        "packages/**/src/**/*.test.ts",
        "packages/**/src/**/__tests__/**",
        "**/dist/**",
        "**/coverage/**",
        "**/node_modules/**"
      ],
      provider: "v8",
      thresholds: {
        statements: 65,
        branches: 35,
        functions: 75,
        lines: 65
      }
    }
  }
});
