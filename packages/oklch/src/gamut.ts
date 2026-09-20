import {
  OKLCH,
  deltaE,
  inGamut as colorjsInGamut,
  to,
  toGamut,
  type PlainColorObject,
} from "colorjs.io/fn";

import {
  GAMUT_EPSILON,
  assertColor,
  assertFinite,
  assertGamut,
  fromColorjs,
  toColorjs,
  wrapHue,
  type Gamut,
  type OkLCH,
} from "./color.js";

/**
 * Is this displayable on this screen?
 *
 * colorjs.io's check, with the tolerance stated: a channel may sit
 * {@link GAMUT_EPSILON} outside [0, 1] and still count. Throws on a
 * non-finite channel or negative chroma rather than answering `false` for a
 * color that was never a color.
 */
export function inGamut(color: OkLCH, gamut: Gamut): boolean {
  const c = assertColor("inGamut", "color", color);
  const g = assertGamut("inGamut", gamut);
  return colorjsInGamut(toColorjs(c), g, { epsilon: GAMUT_EPSILON });
}

/**
 * A chroma no color in the gamut reaches: the most saturated corner of the
 * gamut's cube plus headroom. Every search starts here and works down.
 */
const CHROMA_CEILING: Record<Gamut, number> = {
  srgb: ceiling("srgb"),
  p3: ceiling("p3"),
};

function ceiling(gamut: Gamut): number {
  const corners: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1],
    [1, 0, 1],
  ];
  const chromas = corners.map(
    (coords) => to({ space: gamut, coords, alpha: 1 }, OKLCH).coords[1] ?? 0,
  );
  return 1.01 * Math.max(...chromas);
}

/** Coarse sweep from 0 to the ceiling, then a bisection inside one step. */
const SCAN_STEPS = 128;
const BISECT_STEPS = 32;

/**
 * How vivid can this step be?
 *
 * The largest chroma at this lightness and hue such that every chroma below
 * it is also displayable: the safe prefix, which a caller may scale by any
 * fraction in [0, 1] and stay in gamut.
 *
 * That is not always the largest displayable chroma. The gamut boundary is
 * not convex in OkLCH: near sRGB blue it re-enters, so the vertex #0000ff
 * sits displayable beyond a band of chroma that is not. A plain bisection
 * can land on the far side of such a gap and report a "maximum" the prefix
 * below it does not honour. This function sweeps upward in fixed steps to
 * find the first crossing, then bisects inside that step — so the answer is
 * always the near edge. The sweep resolution is 1/128 of the gamut's chroma
 * ceiling; a re-entry narrower than that would be stepped over, and none is
 * known.
 *
 * Fixed iteration counts: the search terminates by construction.
 *
 * Returns 0 at L = 0 and L = 1, where only black and white exist. Throws on
 * lightness outside [0, 1], a non-finite argument, or a missing gamut.
 */
export function maxChroma(L: number, H: number, gamut: Gamut): number {
  assertFinite("maxChroma", "L", L);
  assertFinite("maxChroma", "H", H);
  const g = assertGamut("maxChroma", gamut);
  if (L < 0 || L > 1) {
    throw new RangeError(
      `maxChroma: lightness ${L} is outside [0, 1]; no display shows a color there`,
    );
  }
  if (L === 0 || L === 1) return 0;

  const h = wrapHue(H);
  const fits = (C: number): boolean =>
    colorjsInGamut({ space: OKLCH, coords: [L, C, h], alpha: 1 }, g, {
      epsilon: GAMUT_EPSILON,
    });

  const top = CHROMA_CEILING[g];
  let clears = 0;
  let fails = top;
  for (let i = 1; i <= SCAN_STEPS; i += 1) {
    const C = (top * i) / SCAN_STEPS;
    if (fits(C)) {
      clears = C;
    } else {
      fails = C;
      break;
    }
  }
  for (let i = 0; i < BISECT_STEPS; i += 1) {
    const mid = (clears + fails) / 2;
    if (fits(mid)) clears = mid;
    else fails = mid;
  }
  return clears;
}

/** What a gamut map did: the color that ships, and how far it is from the one asked for. */
export interface GamutMapReport {
  /** The color as asked for, hue wrapped. */
  readonly requested: OkLCH;
  /** The color that ships: inside the gamut, or `requested` itself when it already was. */
  readonly color: OkLCH;
  /** Whether anything changed. */
  readonly moved: boolean;
  /** Perceived distance moved, in ΔEOK. One just-noticeable difference is 0.02. */
  readonly deltaEOK: number;
  /** `color.L - requested.L`. */
  readonly deltaL: number;
  /** `color.C - requested.C`; a map only ever gives chroma up, so this is ≤ 0. */
  readonly deltaC: number;
  /** Shortest signed arc from `requested.H` to `color.H`, in degrees. */
  readonly deltaH: number;
}

/**
 * Where does it land if not?
 *
 * The CSS Color 4 gamut mapping algorithm (colorjs.io's `css` method): reduce
 * chroma at constant lightness and hue until the color is within one
 * just-noticeable difference (0.02 ΔEOK) of something the gamut can show,
 * then clip. Browsers do not do this — they clip, which shifts hue and
 * lightness — so `gamutMap(color, "srgb")` is the tool for seeing what a
 * non-P3 screen should have been handed.
 *
 * Returns a report, never a bare color: what shipped, whether it moved, and
 * by how much in each channel and in perceived distance. Throws on a
 * non-finite channel, negative chroma, or a missing gamut.
 */
export function gamutMap(color: OkLCH, gamut: Gamut): GamutMapReport {
  const requested = assertColor("gamutMap", "color", color);
  const g = assertGamut("gamutMap", gamut);

  if (colorjsInGamut(toColorjs(requested), g, { epsilon: GAMUT_EPSILON })) {
    return {
      requested,
      color: requested,
      moved: false,
      deltaEOK: 0,
      deltaL: 0,
      deltaC: 0,
      deltaH: 0,
    };
  }

  // toGamut mutates its argument; toColorjs hands it a fresh object.
  const mapped = fromColorjs(
    toGamut(toColorjs(requested), {
      method: "css",
      space: g,
    }) as PlainColorObject,
  );
  return {
    requested,
    color: mapped,
    moved: true,
    deltaEOK: deltaE(toColorjs(requested), toColorjs(mapped), "OK"),
    deltaL: mapped.L - requested.L,
    deltaC: mapped.C - requested.C,
    deltaH: hueArc(requested.H, mapped.H),
  };
}

/** Shortest signed arc from one hue to another, in (-180, 180]. */
export function hueArc(from: number, to: number): number {
  const arc = wrapHue(to - from);
  return arc > 180 ? arc - 360 : arc;
}
