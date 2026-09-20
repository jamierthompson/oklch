import { describe, expect, it } from "vitest";

import { formatHex, formatOklch } from "./format.js";
import { inGamut } from "./gamut.js";
import { parseColor } from "./parse.js";

describe("formatOklch", () => {
  it("emits the channel values digit for digit", () => {
    expect(formatOklch({ L: 0.1 + 0.2, C: 0.123456789012345, H: 30 })).toBe(
      "oklch(0.30000000000000004 0.123456789012345 30)",
    );
  });

  it("does not round: colorjs.io's five-digit default is off", () => {
    expect(formatOklch({ L: 0.123456789, C: 0.1, H: 30 })).toBe(
      "oklch(0.123456789 0.1 30)",
    );
  });

  it("round-trips doubles that colorjs.io's 17-digit serializer does not", () => {
    // colorjs.io rounds with floor(n * 1e17 + 0.5) / 1e17, which is lossy in
    // the last bit; this value came back one ulp off through it.
    const L = 0.9798781762489561;
    expect(formatOklch({ L, C: 0.004, H: 260 })).toBe(
      "oklch(0.9798781762489561 0.004 260)",
    );
    expect(parseColor(formatOklch({ L, C: 0.004, H: 260 }))).toEqual({
      L,
      C: 0.004,
      H: 260,
    });
  });

  it("does not gamut-map: colorjs.io's default is off", () => {
    expect(formatOklch({ L: 0.6, C: 0.35, H: 30 })).toBe("oklch(0.6 0.35 30)");
  });

  it("wraps hue and emits no alpha", () => {
    expect(formatOklch({ L: 0.5, C: 0.1, H: -30 })).toBe("oklch(0.5 0.1 330)");
  });

  it("emits tiny magnitudes in a form CSS accepts", () => {
    expect(parseColor(formatOklch({ L: 0.5, C: 1e-9, H: 30 }))).toEqual({
      L: 0.5,
      C: 1e-9,
      H: 30,
    });
  });

  it("throws on a non-finite channel rather than emitting NaN", () => {
    expect(() => formatOklch({ L: NaN, C: 0.1, H: 30 })).toThrow(
      /^formatOklch: color channel L is NaN/,
    );
  });

  it("refuses negative chroma", () => {
    expect(() => formatOklch({ L: 0.5, C: -0.1, H: 30 })).toThrow(/negative/);
  });
});

describe("formatHex", () => {
  it("emits six lowercase digits and reports the 8-bit loss", () => {
    const report = formatHex({ L: 0.5, C: 0.1, H: 30 });
    expect(report.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(inGamut(report.color, "srgb")).toBe(true);
    expect(report.deltaEOK).toBeGreaterThan(0);
    expect(report.deltaEOK).toBeLessThan(0.02);
    expect(parseColor(report.hex)).toEqual(report.color);
  });

  it("never collapses to three digits", () => {
    expect(formatHex(parseColor("#fff")!).hex).toBe("#ffffff");
  });

  it("is exact for a color that came from hex", () => {
    const report = formatHex(parseColor("#3366cc")!);
    expect(report.hex).toBe("#3366cc");
    expect(report.deltaEOK).toBeLessThan(1e-12);
  });

  it("refuses out-of-sRGB input by name rather than clamping", () => {
    expect(() => formatHex({ L: 0.6, C: 0.35, H: 30 })).toThrow(
      /^formatHex: oklch\(0.6 0.35 30\) is outside sRGB, and hex cannot hold it/,
    );
  });

  it("throws on a non-finite channel", () => {
    expect(() => formatHex({ L: 0.5, C: 0.1, H: Infinity })).toThrow(
      /channel H is Infinity/,
    );
  });
});
