import { describe, expect, it } from "vitest";

import { inGamut, maxChroma } from "./tier1.js";
import { TAILWIND_STOPS, createRamp } from "./generate.js";
import { inspectRamp } from "./ramp.js";

const BLUE = { hue: 260, saturation: 0.8, gamut: "srgb" } as const;

describe("createRamp", () => {
  it("draws Tailwind's eleven chromatic stops by default, at the hue given", () => {
    const ramp = createRamp(BLUE);
    expect(ramp.steps).toHaveLength(11);
    expect(ramp.lightness).toEqual([...TAILWIND_STOPS.chromatic]);
    expect(ramp.steps.map((s) => s.L)).toEqual([...TAILWIND_STOPS.chromatic]);
    for (const step of ramp.steps) expect(step.H).toBe(260);
    expect(ramp.through).toBeNull();
    expect(ramp.hue).toBe(260);
    expect(ramp.saturation).toBe(0.8);
  });

  it("gives every step the same share of the safe prefix, so it is in gamut by construction", () => {
    for (const gamut of ["srgb", "p3"] as const) {
      const ramp = createRamp({ ...BLUE, saturation: 1, gamut });
      for (const step of ramp.steps) {
        expect(step.C).toBeCloseTo(maxChroma(step.L, step.H, gamut), 12);
        expect(inGamut(step, gamut)).toBe(true);
      }
    }
  });

  it("is a ramp inspectRamp reads as one: lightness one way, nothing moved by the map", () => {
    const report = inspectRamp(createRamp(BLUE).steps, "srgb");
    expect(report.lightness.direction).toBe("decreasing");
    for (const step of report.steps) {
      expect(step.map.moved).toBe(false);
      expect(step.chromaShare).toBeCloseTo(0.8, 6);
    }
  });

  it("takes any stops, in either direction", () => {
    const rising = createRamp({ ...BLUE, lightness: [0.2, 0.5, 0.9] });
    expect(rising.steps.map((s) => s.L)).toEqual([0.2, 0.5, 0.9]);
    expect(inspectRamp(rising.steps, "srgb").lightness.direction).toBe(
      "increasing",
    );
    expect(
      createRamp({ ...BLUE, lightness: TAILWIND_STOPS.neutral }).steps,
    ).toHaveLength(11);
    expect(createRamp({ ...BLUE, lightness: [0.5] }).steps).toHaveLength(1);
  });

  it("drifts hue linearly from the first step by hueShift, wrapping", () => {
    const ramp = createRamp({
      ...BLUE,
      hue: 350,
      hueShift: 30,
      lightness: [0.9, 0.7, 0.5, 0.3],
    });
    expect(ramp.steps.map((s) => s.H)).toEqual([350, 0, 10, 20]);
  });

  it("wraps the hue", () => {
    expect(createRamp({ ...BLUE, hue: -100 }).hue).toBe(260);
  });

  it("is achromatic at saturation 0", () => {
    for (const step of createRamp({ ...BLUE, saturation: 0 }).steps)
      expect(step.C).toBe(0);
  });

  describe("through a seed color", () => {
    const seed = { L: 0.55, C: 0.18, H: 30 };

    it("places the seed color on the nearest stop, exactly", () => {
      const ramp = createRamp({ through: seed, gamut: "srgb" });
      expect(ramp.through).not.toBeNull();
      const { index, color } = ramp.through!;
      // 0.55 is nearest Tailwind's 600 stop (0.56).
      expect(index).toBe(6);
      expect(ramp.steps[index]).toEqual({ L: 0.55, C: 0.18, H: 30 });
      expect(color).toEqual(ramp.steps[index]);
      expect(ramp.lightness[index]).toBe(0.55);
      expect(ramp.lightness.filter((_, i) => i !== index)).toEqual(
        TAILWIND_STOPS.chromatic.filter((_, i) => i !== index),
      );
    });

    it("derives the ramp's hue and saturation from the seed color", () => {
      const ramp = createRamp({ through: seed, gamut: "srgb" });
      expect(ramp.hue).toBe(30);
      expect(ramp.saturation).toBeCloseTo(
        0.18 / maxChroma(0.55, 30, "srgb"),
        12,
      );
      for (const step of ramp.steps) {
        expect(step.H).toBe(30);
        expect(step.C).toBeCloseTo(
          ramp.saturation * maxChroma(step.L, 30, "srgb"),
          12,
        );
      }
    });

    it("keeps the seed hue at the anchor when the hue drifts", () => {
      const ramp = createRamp({ through: seed, hueShift: 40, gamut: "srgb" });
      expect(ramp.steps[ramp.through!.index]!.H).toBe(30);
      expect(ramp.steps[0]!.H).toBeLessThan(30);
      expect(ramp.steps[10]!.H).toBeGreaterThan(30);
    });

    it("refuses a seed color beyond the safe chroma, naming the map as the tool", () => {
      expect(() =>
        createRamp({ through: { L: 0.55, C: 0.4, H: 30 }, gamut: "srgb" }),
      ).toThrow(
        /^createRamp: through oklch\(0.55 0.4 30\) sits beyond the safe chroma .* in srgb; gamutMap it/,
      );
    });

    it("refuses a seed color that is not one", () => {
      expect(() =>
        createRamp({ through: { L: 0.5, C: -0.1, H: 30 }, gamut: "srgb" }),
      ).toThrow(/^createRamp: through chroma -0.1 is negative/);
      expect(() =>
        createRamp({ through: { L: 1.2, C: 0, H: 30 }, gamut: "srgb" }),
      ).toThrow(/through lightness 1.2 is outside/);
      expect(() =>
        createRamp({ through: { L: 0.5, C: 0.1, H: NaN }, gamut: "srgb" }),
      ).toThrow(/through channel H is NaN/);
    });

    it("refuses through together with a hue, and neither", () => {
      expect(() =>
        // @ts-expect-error the contract under test
        createRamp({ ...BLUE, through: seed }),
      ).toThrow(/^createRamp: both `hue`\/`saturation` and `through`/);
      // @ts-expect-error the contract under test
      expect(() => createRamp({ gamut: "srgb" })).toThrow(
        /^createRamp: pass `hue` and `saturation` to draw a ramp, or `through`/,
      );
    });
  });

  it("refuses stops outside [0, 1], an empty list, and lightness that turns back", () => {
    expect(() => createRamp({ ...BLUE, lightness: [] })).toThrow(
      /^createRamp: lightness has no stops/,
    );
    expect(() => createRamp({ ...BLUE, lightness: [0.9, 1.1] })).toThrow(
      /lightness\[1\] 1.1 is outside \[0, 1\]/,
    );
    expect(() => createRamp({ ...BLUE, lightness: [0.9, NaN] })).toThrow(
      /lightness\[1\] is NaN/,
    );
    expect(() => createRamp({ ...BLUE, lightness: [0.9, 0.5, 0.7] })).toThrow(
      /^createRamp: lightness runs 0.5 then 0.7 at steps 1 and 2; a ramp's lightness runs one way/,
    );
    expect(() => createRamp({ ...BLUE, lightness: [0.9, 0.9] })).toThrow(
      /runs 0.9 then 0.9/,
    );
  });

  it("refuses saturation outside [0, 1], non-finite options, and a missing gamut", () => {
    expect(() => createRamp({ ...BLUE, saturation: 4 })).toThrow(
      /^createRamp: saturation 4 is outside \[0, 1\]/,
    );
    expect(() => createRamp({ ...BLUE, hue: NaN })).toThrow(
      /^createRamp: hue is NaN/,
    );
    expect(() => createRamp({ ...BLUE, hueShift: Infinity })).toThrow(
      /^createRamp: hueShift is Infinity/,
    );
    // @ts-expect-error the contract under test
    expect(() => createRamp({ ...BLUE, gamut: undefined })).toThrow(
      /^createRamp: gamut is undefined/,
    );
  });
});
