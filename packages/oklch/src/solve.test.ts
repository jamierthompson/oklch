import { describe, expect, it } from "vitest";

import { CONTRAST_TARGETS, checkContrast } from "./contrast.js";
import { parseColor } from "./parse.js";
import { solveBackground, solveForeground } from "./solve.js";

const BLACK = parseColor("#000")!;
const WHITE = parseColor("#fff")!;
const GREY = { C: 0, H: 0 };
const BODY = CONTRAST_TARGETS.bodyText;
const STEP = 1e-6;

describe("solveBackground", () => {
  it("finds the darkest surface black text still clears, and one step darker fails", () => {
    const solved = solveBackground(BLACK, BODY, {
      surface: GREY,
      range: { safe: 1, limit: 0 },
      gamut: "srgb",
    });
    const { background } = solved;
    expect(background.check.passes).toBe(true);
    expect(background.lightness).toBeGreaterThan(0);
    expect(background.lightness).toBeLessThan(1);
    const darker = { L: background.lightness - STEP, C: 0, H: 0 };
    expect(checkContrast(BLACK, darker, BODY).passes).toBe(false);
  });

  it("reports the text's sRGB fallback, the surface that ships, and the measurement", () => {
    const solved = solveBackground(BLACK, BODY, {
      surface: { C: 0.05, H: 250 },
      range: { safe: 1, limit: 0 },
      gamut: "srgb",
    });
    expect(solved.text.color).toEqual(BLACK);
    expect(solved.text.fallback.moved).toBe(false);
    expect(solved.background.color.L).toBe(solved.background.lightness);
    expect(solved.background.fallback.color).toEqual(solved.background.color);
    expect(solved.background.check.wcag.passes).toBe(true);
    expect(solved.background.check.apca.passes).toBe(true);
  });

  it("returns the limit when the whole range clears", () => {
    const solved = solveBackground(BLACK, BODY, {
      surface: GREY,
      range: { safe: 1, limit: 0.9 },
      gamut: "srgb",
    });
    expect(solved.background.lightness).toBe(0.9);
  });

  it("throws by name when even the safe end fails", () => {
    expect(() =>
      solveBackground(BLACK, BODY, {
        surface: GREY,
        range: { safe: 0.3, limit: 0.1 },
        gamut: "srgb",
      }),
    ).toThrow(
      /^solveBackground: even the safe end of the range \(L 0.3\) does not clear/,
    );
  });

  it("refuses a range that straddles the text's lightness", () => {
    const grey = { L: 0.5, C: 0, H: 0 };
    expect(() =>
      solveBackground(grey, BODY, {
        surface: GREY,
        range: { safe: 1, limit: 0 },
        gamut: "srgb",
      }),
    ).toThrow(
      /^solveBackground: the range \[1, 0\] straddles the text's lightness 0.5/,
    );
  });

  it("refuses a range that is not finite or not a lightness", () => {
    expect(() =>
      solveBackground(BLACK, BODY, {
        surface: GREY,
        range: { safe: NaN, limit: 0 },
        gamut: "srgb",
      }),
    ).toThrow(/^solveBackground: range.safe is NaN/);
    expect(() =>
      solveBackground(BLACK, BODY, {
        surface: GREY,
        range: { safe: 1.5, limit: 0 },
        gamut: "srgb",
      }),
    ).toThrow(/range.safe 1.5 is outside \[0, 1\]/);
  });

  it("refuses text outside the gamut being solved for", () => {
    expect(() =>
      solveBackground({ L: 0.6, C: 0.35, H: 30 }, BODY, {
        surface: GREY,
        range: { safe: 1, limit: 0 },
        gamut: "p3",
      }),
    ).toThrow(/^solveBackground: text oklch\(0.6 0.35 30\) is outside p3/);
  });

  it("throws on a missing gamut and on negative surface chroma", () => {
    expect(() =>
      // @ts-expect-error the contract under test
      solveBackground(BLACK, BODY, {
        surface: GREY,
        range: { safe: 1, limit: 0 },
      }),
    ).toThrow(/gamut is undefined/);
    expect(() =>
      solveBackground(BLACK, BODY, {
        surface: { C: -0.1, H: 0 },
        range: { safe: 1, limit: 0 },
        gamut: "srgb",
      }),
    ).toThrow(/surface.C -0.1 is negative/);
  });

  it("solves for P3 and measures the sRGB fallback", () => {
    const solved = solveBackground(BLACK, BODY, {
      surface: { C: 0.3, H: 30 },
      range: { safe: 1, limit: 0 },
      gamut: "p3",
    });
    expect(solved.background.fallback.requested).toEqual(
      solved.background.color,
    );
    expect(solved.background.check.passes).toBe(true);
  });

  it("moves with the target: a stricter bar stops sooner", () => {
    const options = {
      surface: GREY,
      range: { safe: 1, limit: 0 },
      gamut: "srgb",
    } as const;
    const body = solveBackground(BLACK, BODY, options).background.lightness;
    const large = solveBackground(BLACK, CONTRAST_TARGETS.largeText, options)
      .background.lightness;
    expect(body).toBeGreaterThan(large);
  });
});

describe("solveForeground", () => {
  it("solves toward both poles and names the nearer", () => {
    const grey = { L: 0.6, C: 0, H: 0 };
    const solved = solveForeground(grey, CONTRAST_TARGETS.interfaceElement, {
      ink: GREY,
      gamut: "srgb",
    });
    expect(solved.toward.light).not.toBeNull();
    expect(solved.toward.dark).not.toBeNull();
    expect(solved.toward.light!.check.passes).toBe(true);
    expect(solved.toward.dark!.check.passes).toBe(true);
    expect(["light", "dark"]).toContain(solved.nearest);
  });

  it("stops at the edge: one step closer to the surface fails", () => {
    const grey = { L: 0.6, C: 0, H: 0 };
    const solved = solveForeground(grey, CONTRAST_TARGETS.interfaceElement, {
      ink: GREY,
      gamut: "srgb",
    });
    const light = solved.toward.light!;
    const dark = solved.toward.dark!;
    expect(
      checkContrast(
        { L: light.lightness - STEP, C: 0, H: 0 },
        grey,
        CONTRAST_TARGETS.interfaceElement,
      ).passes,
    ).toBe(false);
    expect(
      checkContrast(
        { L: dark.lightness + STEP, C: 0, H: 0 },
        grey,
        CONTRAST_TARGETS.interfaceElement,
      ).passes,
    ).toBe(false);
  });

  it("returns null for a pole that does not clear rather than guessing", () => {
    // A light mid-tone: white cannot clear large text on it, black can. A
    // solver that picked by L >= 0.5 would have guessed on the other side.
    const light = { L: 0.8, C: 0, H: 0 };
    const solved = solveForeground(light, CONTRAST_TARGETS.largeText, {
      ink: GREY,
      gamut: "srgb",
    });
    expect(solved.toward.light).toBeNull();
    expect(solved.toward.dark).not.toBeNull();
    expect(solved.nearest).toBe("dark");
  });

  it("throws by name when neither pole clears", () => {
    expect(() =>
      solveForeground(
        { L: 0.5, C: 0, H: 0 },
        { wcag: 30, apca: 200 },
        { ink: GREY, gamut: "srgb" },
      ),
    ).toThrow(/^solveForeground: no ink at chroma 0, hue 0 clears the target/);
  });

  it("reports what ships and what was measured for a chromatic ink in P3", () => {
    const solved = solveForeground(WHITE, BODY, {
      ink: { C: 0.3, H: 30 },
      gamut: "p3",
    });
    const dark = solved.toward.dark!;
    expect(dark.check.passes).toBe(true);
    expect(Math.abs(dark.color.H - 30)).toBeLessThan(3);
    expect(dark.fallback.requested).toEqual(dark.color);
    expect(solved.background.fallback.moved).toBe(false);
  });

  it("refuses a background outside the gamut, a missing gamut, and negative ink chroma", () => {
    expect(() =>
      solveForeground({ L: 0.6, C: 0.35, H: 30 }, BODY, {
        ink: GREY,
        gamut: "srgb",
      }),
    ).toThrow(
      /^solveForeground: background oklch\(0.6 0.35 30\) is outside srgb/,
    );
    // @ts-expect-error the contract under test
    expect(() => solveForeground(WHITE, BODY, { ink: GREY })).toThrow(
      /gamut is undefined/,
    );
    expect(() =>
      solveForeground(WHITE, BODY, { ink: { C: -1, H: 0 }, gamut: "srgb" }),
    ).toThrow(/ink.C -1 is negative/);
  });
});
