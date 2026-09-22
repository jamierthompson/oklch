import { auditOf, newTheme } from "@/lib/theme.ts";
import { describe, expect, it } from "vitest";

import { SEEDS } from "./seeds.ts";

describe("SEEDS", () => {
  it.each(SEEDS)(
    "$name makes a theme that clears out of the box in both gamuts",
    ({ name, color }) => {
      for (const gamut of ["srgb", "p3"] as const) {
        expect(
          auditOf(newTheme(name, color, gamut)).passes,
          `${name} in ${gamut}`,
        ).toBe(true);
      }
    },
  );
});
