import { describe, expect, it } from "vitest";

import { CONTRAST_TARGETS, inGamut, parseColor } from "./tier1.js";
import { inspectRamp, minPass } from "./ramp.js";

const WHITE = parseColor("#fff")!;

// A blue ramp an eye might place: hue drifts, chroma peaks in the middle.
const BLUES = [
  { L: 0.97, C: 0.012, H: 254 },
  { L: 0.88, C: 0.04, H: 255 },
  { L: 0.71, C: 0.13, H: 258 },
  { L: 0.55, C: 0.19, H: 262 },
  { L: 0.42, C: 0.16, H: 265 },
  { L: 0.28, C: 0.09, H: 268 },
];

describe("inspectRamp", () => {
  it("generates nothing: one step in, one step out, as placed", () => {
    const report = inspectRamp(BLUES, "srgb");
    for (const step of BLUES) expect(inGamut(step, "srgb")).toBe(true);
    expect(report.steps).toHaveLength(BLUES.length);
    report.steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.requested).toEqual(BLUES[i]);
      expect(step.color).toEqual(step.map.color);
      expect(inGamut(step.color, "srgb")).toBe(true);
    });
  });

  it("reports chroma as a share of the safe prefix, and whether it sits on the cusp", () => {
    const report = inspectRamp(BLUES, "srgb");
    for (const step of report.steps) {
      expect(step.maxChroma).toBeGreaterThan(0);
      expect(step.chromaShare).toBeGreaterThan(0);
      expect(step.chromaShare).toBeLessThanOrEqual(1 + 1e-9);
    }
    // A step placed beyond the boundary is mapped onto it.
    const pushed = inspectRamp([{ L: 0.55, C: 0.4, H: 262 }], "srgb").steps[0]!;
    expect(pushed.map.moved).toBe(true);
    expect(pushed.onCusp).toBe(true);
  });

  it("measures both meters against white and black on the sRGB fallback", () => {
    const step = inspectRamp(BLUES, "srgb").steps[3]!;
    expect(step.contrast.onWhite.wcag).toBeGreaterThan(1);
    expect(step.contrast.onWhite.apca).toBeGreaterThan(0);
    expect(step.contrast.onBlack.apca).toBeLessThan(0);
    expect(step.fallback.moved).toBe(false);
  });

  it("reports the sRGB fallback of a P3 ramp, step by step", () => {
    const report = inspectRamp([{ L: 0.62, C: 0.26, H: 30 }], "p3");
    const step = report.steps[0]!;
    expect(step.map.moved).toBe(false);
    expect(step.fallback.moved).toBe(true);
    expect(inGamut(step.fallback.color, "srgb")).toBe(true);
  });

  it("measures the gaps between neighbours and where the spacing bunches", () => {
    const report = inspectRamp(BLUES, "srgb");
    expect(report.gaps).toHaveLength(BLUES.length - 1);
    report.gaps.forEach((gap, i) => {
      expect(gap.from).toBe(i);
      expect(gap.to).toBe(i + 1);
      expect(gap.deltaEOK).toBeGreaterThan(0);
      expect(gap.shareOfMean).toBeCloseTo(
        gap.deltaEOK / report.spacing.mean,
        12,
      );
    });
    const shares = report.gaps.map((g) => g.shareOfMean);
    expect(shares.reduce((a, b) => a + b, 0) / shares.length).toBeCloseTo(
      1,
      12,
    );
    expect(report.gaps[report.spacing.tightest!]!.deltaEOK).toBe(
      Math.min(...report.gaps.map((g) => g.deltaEOK)),
    );
    expect(report.gaps[report.spacing.widest!]!.deltaEOK).toBe(
      Math.max(...report.gaps.map((g) => g.deltaEOK)),
    );
  });

  it("says which way lightness runs, and when it does not", () => {
    expect(inspectRamp(BLUES, "srgb").lightness.direction).toBe("decreasing");
    expect(inspectRamp([...BLUES].reverse(), "srgb").lightness.direction).toBe(
      "increasing",
    );
    expect(
      inspectRamp([BLUES[0]!, BLUES[2]!, BLUES[1]!], "srgb").lightness
        .direction,
    ).toBe("mixed");
    expect(
      inspectRamp(
        [
          { L: 0.5, C: 0.05, H: 0 },
          { L: 0.5, C: 0.1, H: 0 },
        ],
        "srgb",
      ).lightness.direction,
    ).toBe("flat");
  });

  it("handles a single step: no gaps, flat, no extremes", () => {
    const report = inspectRamp([BLUES[0]!], "srgb");
    expect(report.gaps).toEqual([]);
    expect(report.lightness.direction).toBe("flat");
    expect(report.spacing).toEqual({ mean: 0, tightest: null, widest: null });
  });

  it("throws on an empty ramp", () => {
    expect(() => inspectRamp([], "srgb")).toThrow(
      /^inspectRamp: the ramp is empty/,
    );
  });

  it("refuses a bad step by name, and a missing gamut", () => {
    expect(() =>
      inspectRamp([BLUES[0]!, { L: 0.5, C: -0.1, H: 0 }], "srgb"),
    ).toThrow(/negative/);
    // @ts-expect-error the contract under test
    expect(() => inspectRamp(BLUES)).toThrow(
      /^inspectRamp: gamut is undefined/,
    );
  });
});

describe("minPass", () => {
  it("returns the first step that clears, with every step's measurement", () => {
    const result = minPass(BLUES, WHITE, CONTRAST_TARGETS.bodyText);
    expect(result.checks).toHaveLength(BLUES.length);
    expect(result.check.passes).toBe(true);
    expect(result.color).toEqual(BLUES[result.index]);
    for (let i = 0; i < result.index; i += 1) {
      expect(result.checks[i]!.passes).toBe(false);
    }
  });

  it("moves with the target: a looser bar clears sooner", () => {
    const body = minPass(BLUES, WHITE, CONTRAST_TARGETS.bodyText).index;
    const ui = minPass(BLUES, WHITE, CONTRAST_TARGETS.interfaceElement).index;
    expect(ui).toBeLessThan(body);
  });

  it("walks from the end on request, and reports the index in the ramp as given", () => {
    const black = parseColor("#000")!;
    const fromStart = minPass(BLUES, black, CONTRAST_TARGETS.bodyText);
    const fromEnd = minPass(BLUES, black, CONTRAST_TARGETS.bodyText, {
      from: "end",
    });
    expect(fromStart.from).toBe("start");
    expect(fromEnd.from).toBe("end");
    expect(fromStart.index).toBe(0);
    expect(fromEnd.index).toBeGreaterThan(fromStart.index);
    expect(fromEnd.color).toEqual(BLUES[fromEnd.index]);
    expect(fromEnd.checks).toEqual(fromStart.checks);
    for (let i = fromEnd.index + 1; i < BLUES.length; i += 1) {
      expect(fromEnd.checks[i]!.passes).toBe(false);
    }
  });

  it("refuses a `from` that is not an end", () => {
    expect(() =>
      minPass(BLUES, WHITE, CONTRAST_TARGETS.bodyText, {
        // @ts-expect-error the contract under test
        from: "middle",
      }),
    ).toThrow(/^minPass: from is middle; pass "start" or "end"/);
  });

  it("throws on an empty ramp rather than returning undefined", () => {
    expect(() => minPass([], WHITE, CONTRAST_TARGETS.bodyText)).toThrow(
      /^minPass: the ramp is empty/,
    );
  });

  it("throws by name when no step clears", () => {
    expect(() =>
      minPass(BLUES.slice(0, 2), WHITE, CONTRAST_TARGETS.bodyText),
    ).toThrow(
      /^minPass: none of the 2 steps clears the target \(WCAG 4.5, APCA 75\) on oklch\(/,
    );
  });

  it("lets the meters refuse an out-of-sRGB step", () => {
    expect(() =>
      minPass([{ L: 0.6, C: 0.35, H: 30 }], WHITE, CONTRAST_TARGETS.bodyText),
    ).toThrow(/^checkContrast: text .* is outside sRGB/);
  });
});
