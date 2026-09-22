import { describe, expect, it } from "vitest";

import { inGamut } from "./gamut.js";
import { HARMONY_KINDS, harmony, rotateHue } from "./hue.js";

const SEED = { L: 0.6, C: 0.15, H: 30 };

describe("rotateHue", () => {
  it("rotates and wraps", () => {
    expect(rotateHue(SEED, 350, "srgb").requested.H).toBe(20);
    expect(rotateHue(SEED, -60, "srgb").requested.H).toBe(330);
    expect(rotateHue(SEED, 720, "srgb").requested).toEqual(SEED);
  });

  it("reports the map's move when the new hue cannot hold the chroma", () => {
    const vivid = { L: 0.9, C: 0.18, H: 100 };
    expect(inGamut(vivid, "srgb")).toBe(true);
    const report = rotateHue(vivid, 180, "srgb");
    expect(report.moved).toBe(true);
    expect(report.deltaC).toBeLessThan(0);
    expect(inGamut(report.color, "srgb")).toBe(true);
  });

  it("throws on a non-finite rotation or a missing gamut", () => {
    expect(() => rotateHue(SEED, NaN, "srgb")).toThrow(
      /^rotateHue: degrees is NaN/,
    );
    // @ts-expect-error the contract under test
    expect(() => rotateHue(SEED, 30)).toThrow(/gamut is undefined/);
  });
});

describe("harmony", () => {
  it("speaks colour-theory vocabulary", () => {
    expect(Object.keys(HARMONY_KINDS)).toEqual([
      "complementary",
      "analogous",
      "triadic",
      "split-complementary",
      "tetradic",
    ]);
  });

  it("returns one mapped report per offset, in offset order", () => {
    const set = harmony(SEED, "triadic", "srgb");
    expect(set.kind).toBe("triadic");
    expect(set.seed).toEqual(SEED);
    expect(set.offsets).toEqual([-120, 120]);
    expect(set.colors.map((c) => c.requested.H)).toEqual([270, 150]);
    for (const report of set.colors) {
      expect(inGamut(report.color, "srgb")).toBe(true);
    }
  });

  it("takes a valid OkLCH only — there is no fallback seed", () => {
    expect(() =>
      harmony({ L: NaN, C: 0.1, H: 0 }, "complementary", "srgb"),
    ).toThrow(/^harmony: seed channel L is NaN/);
  });

  it("refuses a kind outside the vocabulary", () => {
    // @ts-expect-error the contract under test
    expect(() => harmony(SEED, "monochrome", "srgb")).toThrow(
      /^harmony: kind is monochrome; pass one of complementary, analogous, triadic, split-complementary, tetradic/,
    );
  });

  it("throws on a missing gamut", () => {
    // @ts-expect-error the contract under test
    expect(() => harmony(SEED, "analogous")).toThrow(/gamut is undefined/);
  });
});
