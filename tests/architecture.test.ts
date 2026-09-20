import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Tier 2 is built from Tier 1's public surface alone. If it needed anything
 * else, the public API would be incomplete, and that is a bug — so the
 * guarantee is a test, not a diagram.
 */
const TIER_2 = ["ramp.ts", "scale.ts"];
const IMPORT = /^\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/gm;

const src = join(import.meta.dirname, "..", "packages", "oklch", "src");

describe("tiers", () => {
  it("lists every non-test module as Tier 1, Tier 2, or the index", () => {
    const modules = readdirSync(src).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    );
    const tier1 = readFileSync(join(src, "tier1.ts"), "utf8");
    for (const file of modules) {
      if (file === "index.ts" || file === "tier1.ts" || TIER_2.includes(file))
        continue;
      expect(tier1, `${file} is exported from tier1.ts`).toContain(
        `./${file.replace(/\.ts$/, ".js")}`,
      );
    }
  });

  it.each(TIER_2)("%s imports from Tier 1's public surface only", (file) => {
    const source = readFileSync(join(src, file), "utf8");
    const specifiers = [...source.matchAll(IMPORT)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier, `${file} imports ${specifier}`).toBe("./tier1.js");
    }
    expect(source).not.toContain("colorjs.io");
  });
});
