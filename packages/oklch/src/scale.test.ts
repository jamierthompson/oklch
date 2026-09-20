import { describe, expect, it } from "vitest";

import { deltaEOK, inGamut } from "./tier1.js";
import { createScale } from "./scale.js";

const FALLING = {
  hue: 250,
  surfaceLightness: 0.98,
  endLightness: 0.35,
  saturation: 0.8,
  gamut: "srgb",
} as const;

describe("createScale", () => {
  it("starts on the surface, achromatic, and ends at the end lightness", () => {
    const scale = createScale(FALLING);
    expect(scale.at(0)).toEqual({ L: 0.98, C: 0, H: 250 });
    expect(scale.at(1).L).toBeCloseTo(0.35, 12);
    expect(scale.travel).toBeGreaterThan(0);
  });

  it("makes equal steps in t equal steps in ΔEOK", () => {
    const scale = createScale(FALLING);
    const gaps = Array.from({ length: 10 }, (_, i) =>
      deltaEOK(scale.at(i / 10), scale.at((i + 1) / 10)),
    );
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const gap of gaps) {
      expect(Math.abs(gap / mean - 1)).toBeLessThan(0.05);
    }
    expect(mean).toBeCloseTo(scale.travel / 10, 3);
  });

  it("stays inside the gamut everywhere, in both gamuts", () => {
    for (const gamut of ["srgb", "p3"] as const) {
      const scale = createScale({ ...FALLING, saturation: 1, gamut });
      for (let i = 0; i <= 100; i += 1) {
        expect(inGamut(scale.at(i / 100), gamut)).toBe(true);
      }
    }
  });

  it("wraps hue", () => {
    expect(createScale({ ...FALLING, hue: -110 }).at(0.5).H).toBe(250);
    expect(createScale({ ...FALLING, hue: -110 }).options.hue).toBe(250);
  });

  it("is a point when nothing moves: same lightness at both ends, no chroma", () => {
    const scale = createScale({
      ...FALLING,
      endLightness: 0.98,
      saturation: 0,
    });
    expect(scale.travel).toBe(0);
    expect(scale.at(0.5)).toEqual(scale.at(0));
  });

  it("refuses a position outside [0, 1] rather than clamping", () => {
    const scale = createScale(FALLING);
    expect(() => scale.at(1.2)).toThrow(
      /^createScale: t 1.2 is not a position in \[0, 1\]/,
    );
    expect(() => scale.at(-0.1)).toThrow(/t -0.1/);
    expect(() => scale.at(NaN)).toThrow(/t NaN/);
  });

  it("refuses saturation outside [0, 1]: it is a fraction, not a multiplier", () => {
    expect(() => createScale({ ...FALLING, saturation: 4 })).toThrow(
      /^createScale: saturation 4 is outside \[0, 1\]/,
    );
    expect(() => createScale({ ...FALLING, saturation: -0.1 })).toThrow(
      /saturation -0.1/,
    );
  });

  it("refuses non-finite options, lightness outside [0, 1], and a missing gamut", () => {
    expect(() => createScale({ ...FALLING, hue: NaN })).toThrow(
      /^createScale: hue is NaN/,
    );
    expect(() => createScale({ ...FALLING, surfaceLightness: 1.5 })).toThrow(
      /surfaceLightness 1.5 is outside/,
    );
    // @ts-expect-error the contract under test
    expect(() => createScale({ ...FALLING, gamut: undefined })).toThrow(
      /^createScale: gamut is undefined/,
    );
  });
});
