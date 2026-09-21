import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "oklch",
          include: ["packages/*/src/**/*.test.ts", "tests/**/*.test.ts"],
        },
      },
      "apps/studio/vitest.config.ts",
    ],
  },
});
