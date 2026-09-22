import { describe, expect, it } from "vitest";

import {
  CONTRAST_TARGETS,
  checkContrast,
  contrastAPCA,
  contrastWCAG,
} from "./contrast.js";
import { gamutMap } from "./gamut.js";
import { parseColor } from "./parse.js";

const WHITE = parseColor("#fff")!;
const BLACK = parseColor("#000")!;
const VIVID = { L: 0.6, C: 0.35, H: 30 };

describe("contrastWCAG", () => {
  it("reaches 21 for black on white and 1 for a color against itself", () => {
    expect(contrastWCAG(BLACK, WHITE)).toBeCloseTo(21, 10);
    expect(contrastWCAG(WHITE, WHITE)).toBeCloseTo(1, 10);
  });

  it("is symmetric", () => {
    expect(contrastWCAG(BLACK, WHITE)).toBe(contrastWCAG(WHITE, BLACK));
  });

  it("refuses out-of-sRGB input by name", () => {
    expect(() => contrastWCAG(VIVID, WHITE)).toThrow(
      /^contrastWCAG: text oklch\(0.6 0.35 30\) is outside sRGB.*gamutMap/,
    );
    expect(() => contrastWCAG(WHITE, VIVID)).toThrow(
      /background oklch\(0.6 0.35 30\) is outside sRGB/,
    );
  });

  it("measures the mapped color once mapped", () => {
    expect(contrastWCAG(gamutMap(VIVID, "srgb").color, WHITE)).toBeGreaterThan(
      1,
    );
  });

  it("names a non-finite channel before the gamut refusal", () => {
    expect(() => contrastWCAG({ L: NaN, C: 0, H: 0 }, WHITE)).toThrow(
      /channel L is NaN/,
    );
  });
});

describe("contrastAPCA", () => {
  it("matches the published extremes and signs by polarity", () => {
    expect(contrastAPCA(BLACK, WHITE)).toBeCloseTo(106.04, 1);
    expect(contrastAPCA(WHITE, BLACK)).toBeCloseTo(-107.88, 1);
  });

  it("distinguishes the two polarities WCAG scores identically", () => {
    const gray = { L: 0.6, C: 0, H: 0 };
    expect(Math.abs(contrastAPCA(gray, WHITE))).not.toBeCloseTo(
      Math.abs(contrastAPCA(WHITE, gray)),
      0,
    );
  });

  it("refuses out-of-sRGB input by name", () => {
    expect(() => contrastAPCA(VIVID, WHITE)).toThrow(
      /^contrastAPCA: text .* is outside sRGB/,
    );
  });
});

describe("CONTRAST_TARGETS", () => {
  it("holds the WCAG 2.2 AA floors and the APCA levels for each role", () => {
    expect(CONTRAST_TARGETS.bodyText).toEqual({ wcag: 4.5, apca: 75 });
    expect(CONTRAST_TARGETS.largeText).toEqual({ wcag: 3, apca: 45 });
    expect(CONTRAST_TARGETS.interfaceElement).toEqual({ wcag: 3, apca: 30 });
  });
});

describe("checkContrast", () => {
  it("reports both meters with target, margin and pass, and the polarity", () => {
    const check = checkContrast(BLACK, WHITE, CONTRAST_TARGETS.bodyText);
    expect(check.passes).toBe(true);
    expect(check.wcag).toEqual({
      value: check.wcag.value,
      target: 4.5,
      margin: check.wcag.value - 4.5,
      passes: true,
    });
    expect(check.apca.target).toBe(75);
    expect(check.apca.margin).toBeCloseTo(check.apca.value - 75, 12);
    expect(check.apca.passes).toBe(true);
    expect(check.apca.polarity).toBe("dark-on-light");
    expect(
      checkContrast(WHITE, BLACK, CONTRAST_TARGETS.bodyText).apca.polarity,
    ).toBe("light-on-dark");
  });

  it("fails a pairing with no contrast, with negative margins", () => {
    const check = checkContrast(WHITE, WHITE, CONTRAST_TARGETS.bodyText);
    expect(check.passes).toBe(false);
    expect(check.wcag.margin).toBeLessThan(0);
    expect(check.apca.margin).toBeLessThan(0);
    expect(check.apca.polarity).toBe("none");
  });

  it("requires both standards, not either", () => {
    // White on a mid gray: WCAG clears its floor and APCA does not. The two
    // standards disagree by about 2x at the same bar, and clearing one is not
    // clearing.
    const gray = { L: 0.6, C: 0, H: 0 };
    const check = checkContrast(WHITE, gray, { wcag: 3, apca: 75 });
    expect(check.wcag.passes).not.toBe(check.apca.passes);
    expect(check.passes).toBe(false);
  });

  it("refuses out-of-sRGB input by name, naming the role", () => {
    expect(() =>
      checkContrast(WHITE, VIVID, CONTRAST_TARGETS.bodyText),
    ).toThrow(
      /^checkContrast: background oklch\(0.6 0.35 30\) is outside sRGB/,
    );
  });

  it("refuses a target that is not a finite number", () => {
    expect(() => checkContrast(BLACK, WHITE, { wcag: NaN, apca: 75 })).toThrow(
      /^checkContrast: target.wcag is NaN/,
    );
  });
});
