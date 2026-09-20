import { describe, expect, it } from "vitest";

import { formatOklch } from "./format.js";
import { parseColor } from "./parse.js";

describe("parseColor", () => {
  it("reads hex, named, rgb() and oklch() syntax into OkLCH", () => {
    const red = parseColor("#ff0000");
    expect(red).not.toBeNull();
    expect(red?.L).toBeCloseTo(0.628, 3);
    expect(red?.C).toBeCloseTo(0.2577, 3);
    expect(red?.H).toBeCloseTo(29.23, 1);
    expect(parseColor("red")).toEqual(red);
    expect(parseColor("rgb(255 0 0)")).toEqual(red);
    expect(parseColor("oklch(0.5 0.1 30)")).toEqual({ L: 0.5, C: 0.1, H: 30 });
  });

  it("reads percentage lightness as a fraction", () => {
    expect(parseColor("oklch(50% 0.1 30)")).toEqual({ L: 0.5, C: 0.1, H: 30 });
  });

  it("wraps hue into [0, 360)", () => {
    expect(parseColor("oklch(0.5 0.1 -30)")?.H).toBe(330);
    expect(parseColor("oklch(0.5 0.1 390)")?.H).toBe(30);
  });

  it("reads an achromatic color's `none` hue as 0, never NaN", () => {
    const white = parseColor("#ffffff");
    expect(white?.C).toBe(0);
    expect(white?.H).toBe(0);
    expect(white?.L).toBeCloseTo(1, 12);
    expect(parseColor("oklch(0.5 none 30)")).toEqual({ L: 0.5, C: 0, H: 30 });
  });

  it("returns null for anything that is not a color", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("nope")).toBeNull();
    expect(parseColor("#ggg")).toBeNull();
    expect(parseColor("oklch(0.5 0.1)")).toBeNull();
  });

  it("returns null for a non-string, because its domain is untrusted input", () => {
    expect(parseColor(undefined)).toBeNull();
    expect(parseColor(null)).toBeNull();
    expect(parseColor(42)).toBeNull();
    expect(parseColor({ L: 0.5, C: 0.1, H: 30 })).toBeNull();
  });

  it("returns null for a translucent color rather than dropping its alpha", () => {
    expect(parseColor("oklch(0.5 0.1 30 / 0.5)")).toBeNull();
    expect(parseColor("rgb(0 0 0 / 0)")).toBeNull();
    expect(parseColor("transparent")).toBeNull();
    expect(parseColor("oklch(0.5 0.1 30 / 1)")).toEqual({
      L: 0.5,
      C: 0.1,
      H: 30,
    });
  });

  it("returns null for negative chroma rather than repairing it", () => {
    expect(parseColor("oklch(0.5 -0.1 30)")).toBeNull();
  });

  it("does not gamut-map: a P3-only color parses as itself", () => {
    expect(parseColor("oklch(0.6 0.35 30)")).toEqual({
      L: 0.6,
      C: 0.35,
      H: 30,
    });
  });

  it("round-trips formatOklch exactly", () => {
    for (const color of [
      { L: 0.1 + 0.2, C: 0.123456789012345, H: 359.999999999999 },
      { L: 0.5, C: 1e-9, H: 0 },
      { L: 0.62, C: 0.35, H: 30 },
    ]) {
      expect(parseColor(formatOklch(color))).toEqual(color);
    }
  });
});
