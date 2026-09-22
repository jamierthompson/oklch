import { auditOf, newBrand } from "@/lib/brand.ts";
import { describe, expect, it } from "vitest";

import { SEEDS } from "./seeds.ts";

describe("SEEDS", () => {
  it.each(SEEDS)(
    "$name makes a brand that clears out of the box in both gamuts",
    ({ name, color }) => {
      for (const gamut of ["srgb", "p3"] as const) {
        expect(
          auditOf(newBrand(name, color, gamut)).passes,
          `${name} in ${gamut}`,
        ).toBe(true);
      }
    },
  );
});
