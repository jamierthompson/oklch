import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "vite";

// One page per function: every folder holding an index.html is an entry.
const pages = readdirSync(import.meta.dirname, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      !["shared", "node_modules", "dist"].includes(entry.name),
  )
  .map(
    (entry) =>
      [
        entry.name,
        resolve(import.meta.dirname, entry.name, "index.html"),
      ] as const,
  )
  .filter(([, html]) => existsSync(html));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        ...Object.fromEntries(pages),
      },
    },
  },
});
