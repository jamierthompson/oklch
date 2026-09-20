import { describe, expect, it } from "vitest";

import { deltaEOK } from "./distance.js";

describe("deltaEOK", () => {
  it("is zero for a color against itself and symmetric", () => {
    const a = { L: 0.5, C: 0.1, H: 30 };
    const b = { L: 0.6, C: 0.2, H: 200 };
    expect(deltaEOK(a, a)).toBe(0);
    expect(deltaEOK(a, b)).toBe(deltaEOK(b, a));
  });

  it("puts black and white one lightness apart", () => {
    expect(deltaEOK({ L: 0, C: 0, H: 0 }, { L: 1, C: 0, H: 0 })).toBeCloseTo(
      1,
      12,
    );
  });

  it("throws on a non-finite channel rather than returning NaN", () => {
    expect(() =>
      deltaEOK({ L: NaN, C: 0, H: 0 }, { L: 1, C: 0, H: 0 }),
    ).toThrow(/^deltaEOK: first channel L is NaN/);
    expect(() =>
      deltaEOK({ L: 0, C: 0, H: 0 }, { L: 1, C: 0, H: -Infinity }),
    ).toThrow(/second channel H is -Infinity/);
  });
});
