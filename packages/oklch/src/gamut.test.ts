import { describe, expect, it } from "vitest";

import { deltaEOK } from "./distance.js";
import { gamutMap, hueArc, inGamut, maxChroma } from "./gamut.js";
import { parseColor } from "./parse.js";
import type { OkLCH } from "./color.js";

const HUES = [0, 29, 90, 142, 195, 264, 328];
const VIVID: OkLCH = { L: 0.6, C: 0.35, H: 30 };

describe("inGamut", () => {
  it("accepts the achromatic axis and every sRGB corner", () => {
    for (const L of [0, 0.25, 0.5, 0.75, 1]) {
      expect(inGamut({ L, C: 0, H: 0 }, "srgb")).toBe(true);
    }
    for (const hex of ["#f00", "#0f0", "#00f", "#ff0", "#0ff", "#f0f"]) {
      const c = parseColor(hex);
      expect(c).not.toBeNull();
      expect(inGamut(c!, "srgb")).toBe(true);
      expect(inGamut(c!, "p3")).toBe(true);
    }
  });

  it("answers per gamut: P3 holds what sRGB cannot", () => {
    const c = { L: 0.62, C: 0.26, H: 30 };
    expect(inGamut(c, "srgb")).toBe(false);
    expect(inGamut(c, "p3")).toBe(true);
    expect(inGamut(VIVID, "p3")).toBe(false);
  });

  it("throws on a non-finite channel rather than answering false", () => {
    expect(() => inGamut({ L: NaN, C: 0.1, H: 30 }, "srgb")).toThrow(
      /^inGamut: color channel L is NaN/,
    );
  });

  it("refuses negative chroma", () => {
    expect(() => inGamut({ L: 0.5, C: -0.1, H: 30 }, "srgb")).toThrow(
      /negative/,
    );
  });

  it("throws on a missing gamut", () => {
    // @ts-expect-error the contract under test
    expect(() => inGamut({ L: 0.5, C: 0.1, H: 30 })).toThrow(
      /^inGamut: gamut is undefined/,
    );
  });
});

describe("maxChroma", () => {
  it("is zero at black and white", () => {
    expect(maxChroma(0, 30, "srgb")).toBe(0);
    expect(maxChroma(1, 30, "srgb")).toBe(0);
  });

  it("refuses lightness outside [0, 1]", () => {
    expect(() => maxChroma(1.2, 30, "srgb")).toThrow(
      /^maxChroma: lightness 1.2 is outside \[0, 1\]/,
    );
    expect(() => maxChroma(-0.1, 30, "srgb")).toThrow(/outside \[0, 1\]/);
  });

  it("throws on a non-finite argument or a missing gamut", () => {
    expect(() => maxChroma(NaN, 30, "srgb")).toThrow(/^maxChroma: L is NaN/);
    expect(() => maxChroma(0.5, Infinity, "srgb")).toThrow(/H is Infinity/);
    // @ts-expect-error the contract under test
    expect(() => maxChroma(0.5, 30)).toThrow(/gamut is undefined/);
  });

  it("returns a chroma on the boundary: inside the gamut, one step more is not", () => {
    for (const H of HUES) {
      for (const L of [0.3, 0.5, 0.7, 0.9]) {
        const C = maxChroma(L, H, "srgb");
        expect(C).toBeGreaterThan(0);
        expect(inGamut({ L, C, H }, "srgb")).toBe(true);
        expect(inGamut({ L, C: C + 1e-3, H }, "srgb")).toBe(false);
      }
    }
  });

  it("is a safe prefix: every fraction of it is displayable", () => {
    for (const H of HUES) {
      const L = 0.55;
      const C = maxChroma(L, H, "srgb");
      for (let i = 0; i <= 50; i += 1) {
        expect(inGamut({ L, C: (C * i) / 50, H }, "srgb")).toBe(true);
      }
    }
  });

  it("stops at the near edge of the sRGB blue notch, where the gamut re-enters", () => {
    // Pure sRGB blue is displayable, yet a band of chroma below it is not: the
    // boundary is concave there. The safe prefix ends at the first crossing,
    // so the vertex sits beyond it. Documented, not pinned to a value.
    const blue = parseColor("#0000ff")!;
    const prefix = maxChroma(blue.L, blue.H, "srgb");
    expect(inGamut(blue, "srgb")).toBe(true);
    expect(blue.C).toBeGreaterThan(prefix);
    expect(
      inGamut({ L: blue.L, C: (prefix + blue.C) / 2, H: blue.H }, "srgb"),
    ).toBe(false);
  });

  it("gives P3 more room than sRGB", () => {
    for (const H of HUES) {
      expect(maxChroma(0.6, H, "p3")).toBeGreaterThan(
        maxChroma(0.6, H, "srgb"),
      );
    }
  });

  it("is periodic in hue", () => {
    expect(maxChroma(0.5, 390, "srgb")).toBe(maxChroma(0.5, 30, "srgb"));
    expect(maxChroma(0.5, -30, "srgb")).toBe(maxChroma(0.5, 330, "srgb"));
  });
});

describe("gamutMap", () => {
  it("leaves a displayable color untouched and says so", () => {
    const c = { L: 0.5, C: 0.1, H: 30 };
    const report = gamutMap(c, "srgb");
    expect(report.color).toEqual(c);
    expect(report.requested).toEqual(c);
    expect(report.moved).toBe(false);
    expect(report.deltaEOK).toBe(0);
    expect(report.deltaC).toBe(0);
  });

  it("returns a displayable color plus what moved", () => {
    const report = gamutMap(VIVID, "srgb");
    expect(report.moved).toBe(true);
    expect(inGamut(report.color, "srgb")).toBe(true);
    expect(report.requested).toEqual(VIVID);
    expect(report.deltaC).toBeLessThan(0);
    expect(report.color.C).toBeCloseTo(VIVID.C + report.deltaC, 12);
    expect(report.deltaEOK).toBeCloseTo(deltaEOK(VIVID, report.color), 12);
    expect(report.deltaEOK).toBeGreaterThan(0.02);
  });

  it("holds lightness and hue close while giving up chroma", () => {
    for (const H of HUES) {
      const report = gamutMap({ L: 0.6, C: 0.35, H }, "srgb");
      expect(Math.abs(report.deltaL)).toBeLessThan(0.02);
      expect(Math.abs(report.deltaH)).toBeLessThan(5);
    }
  });

  it("keeps more chroma in P3 than in sRGB", () => {
    const p3 = gamutMap(VIVID, "p3");
    const srgb = gamutMap(VIVID, "srgb");
    expect(p3.color.C).toBeGreaterThan(srgb.color.C);
    expect(inGamut(p3.color, "p3")).toBe(true);
  });

  it("does not mutate its argument", () => {
    const c = { ...VIVID };
    gamutMap(c, "srgb");
    expect(c).toEqual(VIVID);
  });

  it("is idempotent", () => {
    const once = gamutMap(VIVID, "srgb");
    const twice = gamutMap(once.color, "srgb");
    expect(twice.moved).toBe(false);
    expect(twice.color).toEqual(once.color);
  });

  it("refuses negative chroma and names the alias", () => {
    expect(() => gamutMap({ L: 0.5, C: -0.1, H: 30 }, "srgb")).toThrow(
      /^gamutMap: color chroma -0.1 is negative.*\{ C: 0.1, H: 210 \}/,
    );
  });

  it("refuses a non-finite channel by name", () => {
    expect(() => gamutMap({ L: 0.5, C: Infinity, H: 30 }, "srgb")).toThrow(
      /channel C is Infinity/,
    );
  });

  it("throws on a missing gamut", () => {
    // @ts-expect-error the contract under test
    expect(() => gamutMap(VIVID)).toThrow(/^gamutMap: gamut is undefined/);
  });

  it("terminates for a chroma no display could ever hold", () => {
    const report = gamutMap({ L: 0.5, C: 1e6, H: 30 }, "srgb");
    expect(inGamut(report.color, "srgb")).toBe(true);
  });
});

describe("hueArc", () => {
  it("takes the short way round, signed", () => {
    expect(hueArc(10, 350)).toBe(-20);
    expect(hueArc(350, 10)).toBe(20);
    expect(hueArc(0, 180)).toBe(180);
  });
});
