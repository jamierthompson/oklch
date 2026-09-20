import { describe, expect, it } from "vitest";

import { assertColor, assertGamut, wrapHue } from "./color.js";

describe("wrapHue", () => {
  it("wraps any finite angle into [0, 360)", () => {
    expect(wrapHue(-30)).toBe(330);
    expect(wrapHue(390)).toBe(30);
    expect(wrapHue(720)).toBe(0);
    expect(wrapHue(-720)).toBe(0);
  });

  it("never returns exactly 360, even when adding 360 rounds up to it", () => {
    expect(wrapHue(-1e-20)).toBe(0);
    expect(wrapHue(-0)).toBe(0);
  });
});

describe("assertColor", () => {
  it("names a non-finite channel", () => {
    expect(() => assertColor("fn", "color", { L: NaN, C: 0.1, H: 30 })).toThrow(
      /^fn: color channel L is NaN, not a finite number/,
    );
    expect(() =>
      assertColor("fn", "color", { L: 0.5, C: Infinity, H: 30 }),
    ).toThrow(/channel C is Infinity/);
  });

  it("refuses negative chroma and names the opposite-hue alias", () => {
    expect(() =>
      assertColor("fn", "color", { L: 0.5, C: -0.1, H: 30 }),
    ).toThrow(/chroma -0.1 is negative.*\{ C: 0.1, H: 210 \}/);
  });

  it("returns the color with its hue wrapped and nothing else changed", () => {
    expect(assertColor("fn", "color", { L: 0.5, C: 0.1, H: -30 })).toEqual({
      L: 0.5,
      C: 0.1,
      H: 330,
    });
  });
});

describe("assertGamut", () => {
  it("accepts the two gamuts", () => {
    expect(assertGamut("fn", "srgb")).toBe("srgb");
    expect(assertGamut("fn", "p3")).toBe("p3");
  });

  it("refuses a missing gamut by name, with no default", () => {
    expect(() => assertGamut("fn", undefined)).toThrow(
      /^fn: gamut is undefined; pass "srgb" or "p3"/,
    );
    expect(() => assertGamut("fn", "rec2020")).toThrow(/gamut is rec2020/);
  });
});
