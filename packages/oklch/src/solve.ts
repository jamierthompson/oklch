import {
  assertColor,
  assertFinite,
  assertGamut,
  describe,
  type Gamut,
  type OkLCH,
} from "./color.js";
import {
  checkContrast,
  type ContrastCheck,
  type ContrastTarget,
} from "./contrast.js";
import { gamutMap, inGamut, type GamutMapReport } from "./gamut.js";

/**
 * Fixed-count bisection: 32 halvings of a lightness interval no wider than 1
 * resolve to 2.3e-10, and the search terminates by construction.
 */
const SOLVE_STEPS = 32;

/** The chroma and hue a solved color is drawn at; the solver moves only lightness. */
export interface Ink {
  readonly C: number;
  readonly H: number;
}

/** One solved color: what ships in the gamut, what sRGB screens get, and what was measured. */
export interface Solved {
  /** The lightness the solver settled on. */
  readonly lightness: number;
  /** The color at that lightness, mapped into the requested gamut. */
  readonly color: OkLCH;
  /** The same color mapped into sRGB: what every meter is defined over, and what non-P3 screens get. */
  readonly fallback: GamutMapReport;
  /** The measurement, taken on the sRGB fallbacks of both colors. */
  readonly check: ContrastCheck;
}

/** The band of lightness a solve may search, from its safe end to its limit. */
export interface LightnessRange {
  /** The end known to clear the target, where the search starts. */
  readonly safe: number;
  /** The end the search moves toward, and will not pass. */
  readonly limit: number;
}

export interface SolveBackgroundOptions {
  /** The surface's chroma and hue; only its lightness is searched. */
  readonly surface: Ink;
  readonly range: LightnessRange;
  readonly gamut: Gamut;
}

export interface SolvedBackground {
  /** The text as given, and its sRGB fallback — the color actually measured. */
  readonly text: { readonly color: OkLCH; readonly fallback: GamutMapReport };
  readonly background: Solved;
}

/**
 * A candidate at this lightness: drawn at the ink's chroma and hue, mapped
 * into the gamut that ships, then mapped into sRGB for measuring. Both maps
 * are reported; neither is silent.
 */
function candidate(
  L: number,
  ink: Ink,
  gamut: Gamut,
): { color: OkLCH; fallback: GamutMapReport } {
  const color = gamutMap({ L, C: ink.C, H: ink.H }, gamut).color;
  return { color, fallback: gamutMap(color, "srgb") };
}

function assertShippable(
  fn: string,
  role: string,
  color: OkLCH,
  gamut: Gamut,
): OkLCH {
  const c = assertColor(fn, role, color);
  if (!inGamut(c, gamut)) {
    throw new RangeError(
      `${fn}: ${role} ${describe(c)} is outside ${gamut}, the gamut being solved for. ` +
        `gamutMap(color, "${gamut}") first so the solve is against what ships.`,
    );
  }
  return c;
}

function assertLightness(fn: string, name: string, value: number): number {
  assertFinite(fn, name, value);
  if (value < 0 || value > 1) {
    throw new RangeError(`${fn}: ${name} ${value} is outside [0, 1]`);
  }
  return value;
}

/**
 * I've placed an ink — how far can the surface move before it stops clearing?
 *
 * Bisects the surface's lightness from `range.safe` toward `range.limit` and
 * returns the furthest point at which `text` still clears `target`. The
 * result was measured, so it holds; the property a test can assert is that
 * one solve step further does not.
 *
 * One-side rule: contrast is not monotone in lightness overall. It falls to
 * zero as the surface approaches the text's own lightness and climbs again
 * beyond it, so a range that straddles the text's lightness would flip the
 * pass test twice and bisection would be meaningless. Such a range is
 * refused by name; solve each side separately.
 *
 * Throws when even `range.safe` fails: there is no lightness to return that
 * would hold. Throws on a text color outside the gamut being solved for.
 */
export function solveBackground(
  text: OkLCH,
  target: ContrastTarget,
  options: SolveBackgroundOptions,
): SolvedBackground {
  const fn = "solveBackground";
  const gamut = assertGamut(fn, options.gamut);
  const t = assertShippable(fn, "text", text, gamut);
  const surface = {
    C: assertFinite(fn, "surface.C", options.surface.C),
    H: assertFinite(fn, "surface.H", options.surface.H),
  };
  if (surface.C < 0) {
    throw new RangeError(
      `${fn}: surface.C ${surface.C} is negative, and chroma is an amount`,
    );
  }
  const safe = assertLightness(fn, "range.safe", options.range.safe);
  const limit = assertLightness(fn, "range.limit", options.range.limit);

  const textFallback = gamutMap(t, "srgb");
  const textL = textFallback.color.L;
  const low = Math.min(safe, limit);
  const high = Math.max(safe, limit);
  if (low < textL && textL < high) {
    throw new RangeError(
      `${fn}: the range [${safe}, ${limit}] straddles the text's lightness ${textL}, ` +
        `where contrast falls to zero and the pass test flips twice. Bisection is only ` +
        `valid on one side; solve each side separately.`,
    );
  }

  const measure = (L: number): Solved => {
    const c = candidate(L, surface, gamut);
    return {
      lightness: L,
      ...c,
      check: checkContrast(textFallback.color, c.fallback.color, target),
    };
  };

  let clears = measure(safe);
  if (!clears.check.passes) {
    throw new RangeError(
      `${fn}: even the safe end of the range (L ${safe}) does not clear the target ` +
        `(WCAG ${target.wcag}, APCA ${target.apca}) for text ${describe(t)}. ` +
        `There is no surface lightness in this range to return.`,
    );
  }
  const atLimit = measure(limit);
  if (atLimit.check.passes) {
    return { text: { color: t, fallback: textFallback }, background: atLimit };
  }

  let fails = limit;
  for (let i = 0; i < SOLVE_STEPS; i += 1) {
    const mid = (clears.lightness + fails) / 2;
    const m = measure(mid);
    if (m.check.passes) clears = m;
    else fails = mid;
  }
  return { text: { color: t, fallback: textFallback }, background: clears };
}

export interface SolveForegroundOptions {
  /** The ink's chroma and hue; only its lightness is searched. */
  readonly ink: Ink;
  readonly gamut: Gamut;
}

export interface SolvedForeground {
  /** The background as given, and its sRGB fallback — the color actually measured. */
  readonly background: {
    readonly color: OkLCH;
    readonly fallback: GamutMapReport;
  };
  /** The nearest clearing ink toward each pole; `null` where even the pole does not clear. */
  readonly toward: {
    readonly light: Solved | null;
    readonly dark: Solved | null;
  };
  /** Which of the two lies closer in lightness to the background. */
  readonly nearest: "light" | "dark";
}

/**
 * I've placed a surface — what's the nearest ink that clears on it?
 *
 * Never guesses a direction. On a mid-tone, black and white can both clear,
 * or neither, and the crossover is not at L 0.5: a solver that picks by
 * `background.L >= 0.5` returns failing black on light mid-tones with no
 * signal. So this solves toward both poles — from white down, from black up
 * — and returns both, with the nearer one named. Each pole's search starts
 * at the pole itself (the safe end) and bisects toward the background's
 * lightness (the limit), so each result is the closest ink that still
 * clears. Throws by name when neither pole clears.
 */
export function solveForeground(
  background: OkLCH,
  target: ContrastTarget,
  options: SolveForegroundOptions,
): SolvedForeground {
  const fn = "solveForeground";
  const gamut = assertGamut(fn, options.gamut);
  const b = assertShippable(fn, "background", background, gamut);
  const ink = {
    C: assertFinite(fn, "ink.C", options.ink.C),
    H: assertFinite(fn, "ink.H", options.ink.H),
  };
  if (ink.C < 0) {
    throw new RangeError(
      `${fn}: ink.C ${ink.C} is negative, and chroma is an amount`,
    );
  }

  const bgFallback = gamutMap(b, "srgb");
  const bgL = bgFallback.color.L;

  const measure = (L: number): Solved => {
    const c = candidate(L, ink, gamut);
    return {
      lightness: L,
      ...c,
      check: checkContrast(c.fallback.color, bgFallback.color, target),
    };
  };

  const solveToward = (pole: 0 | 1): Solved | null => {
    let clears = measure(pole);
    if (!clears.check.passes) return null;
    let fails = bgL;
    for (let i = 0; i < SOLVE_STEPS; i += 1) {
      const mid = (clears.lightness + fails) / 2;
      const m = measure(mid);
      if (m.check.passes) clears = m;
      else fails = mid;
    }
    return clears;
  };

  const light = solveToward(1);
  const dark = solveToward(0);
  if (light === null && dark === null) {
    throw new RangeError(
      `${fn}: no ink at chroma ${ink.C}, hue ${ink.H} clears the target ` +
        `(WCAG ${target.wcag}, APCA ${target.apca}) on ${describe(b)} toward either pole. ` +
        `Lower the chroma, or move the surface.`,
    );
  }

  const distance = (s: Solved | null): number =>
    s === null ? Number.POSITIVE_INFINITY : Math.abs(s.lightness - bgL);
  const nearest = distance(light) <= distance(dark) ? "light" : "dark";
  return {
    background: { color: b, fallback: bgFallback },
    toward: { light, dark },
    nearest,
  };
}
