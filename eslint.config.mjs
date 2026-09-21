import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default defineConfig([
  globalIgnores(["**/dist/**", "**/coverage/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["*.mjs", "*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // The library is pure and isomorphic: no DOM, no node, no framework.
    files: ["packages/oklch/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "process",
        "Buffer",
        "__dirname",
        "__filename",
      ],
    },
  },
  {
    files: ["examples/**/*.ts", "apps/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  prettier,
]);
