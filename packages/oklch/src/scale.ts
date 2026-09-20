/**
 * Tier 2: a continuous scale for data, not a palette. Built from Tier 1 alone.
 */

import {
  deltaEOK,
  GAMUTS,
  maxChroma,
  wrapHue,
  type Gamut,
  type OkLCH,
} from "./tier1.js";

export interface ScaleOptions {
  /** Hue held across the scale, any finite angle. */
  readonly hue: number;
  /** Lightness at t = 0, normally the surface the data sits on. */
  readonly surfaceLightness: number;
  /** Lightness at t = 1, the strongest end. */
  readonly endLightness: number;
  /** Fraction of the safe-prefix chroma to use at each lightness, 0 to 1. An amount: refused outside that range. */
  readonly saturation: number;
  readonly gamut: Gamut;
}

export interface Scale {
  /** The color at position t in [0, 1]. Refuses t outside that range, or NaN. */
  readonly at: (t: number) => OkLCH;
  /** Total perceived length of the curve, in ΔEOK. */
  readonly travel: number;
  readonly options: ScaleOptions;
}

/** Enough that the lightness step between samples sits far below one JND. */
const SAMPLES = 256;

/**
 * Equal steps in data → equal perceived steps?
 *
 * A continuous sequential scale: one hue, lightness carrying the magnitude,
 * chroma a fraction of the gamut's safe prefix at each lightness, rising
 * from nothing at the surface. Walking that curve at an even rate does not
 * walk it at an even *perceived* rate, so the curve is sampled, the ΔEOK
 * along it accumulated, and the table inverted — `at(t)` is parameterized
 * by distance travelled. Every color returned is inside the gamut by
 * construction, because chroma never exceeds the safe prefix.
 *
 * For data (a heatmap, an activation), not for palettes: a palette is a
 * list of steps an eye placed, and `inspectRamp` is its tool.
 *
 * Refuses non-finite options, lightness outside [0, 1], saturation outside
 * [0, 1], and a missing gamut. Hue wraps.
 */
export function createScale(options: ScaleOptions): Scale {
  const fn = "createScale";
  for (const key of [
    "hue",
    "surfaceLightness",
    "endLightness",
    "saturation",
  ] as const) {
    if (!Number.isFinite(options[key])) {
      throw new RangeError(
        `${fn}: ${key} is ${String(options[key])}, not a finite number`,
      );
    }
  }
  for (const key of ["surfaceLightness", "endLightness"] as const) {
    if (options[key] < 0 || options[key] > 1) {
      throw new RangeError(`${fn}: ${key} ${options[key]} is outside [0, 1]`);
    }
  }
  if (options.saturation < 0 || options.saturation > 1) {
    throw new RangeError(
      `${fn}: saturation ${options.saturation} is outside [0, 1]; it is a fraction of the ` +
        `chroma available at each lightness, and there is no chroma beyond the boundary to use`,
    );
  }
  if (!GAMUTS.includes(options.gamut)) {
    throw new TypeError(
      `${fn}: gamut is ${String(options.gamut)}; pass "srgb" or "p3". There is no default.`,
    );
  }

  const hue = wrapHue(options.hue);
  const { surfaceLightness, endLightness, saturation, gamut } = options;
  const point = (u: number): OkLCH => {
    const L = surfaceLightness + u * (endLightness - surfaceLightness);
    return { L, C: saturation * u * maxChroma(L, hue, gamut), H: hue };
  };

  const samples: OkLCH[] = [];
  const travelled: number[] = [0];
  let total = 0;
  for (let i = 0; i < SAMPLES; i += 1) {
    const p = point(i / (SAMPLES - 1));
    if (i > 0) {
      total += deltaEOK(samples[i - 1]!, p);
      travelled.push(total);
    }
    samples.push(p);
  }

  const at = (t: number): OkLCH => {
    if (!(t >= 0 && t <= 1)) {
      throw new RangeError(`${fn}: t ${String(t)} is not a position in [0, 1]`);
    }
    if (total === 0) return samples[0]!;
    const target = t * total;
    let low = 0;
    let high = SAMPLES - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (travelled[mid]! <= target) low = mid;
      else high = mid;
    }
    const span = travelled[high]! - travelled[low]!;
    const within = span === 0 ? 0 : (target - travelled[low]!) / span;
    const a = samples[low]!;
    const b = samples[high]!;
    return {
      L: a.L + within * (b.L - a.L),
      C: a.C + within * (b.C - a.C),
      H: hue,
    };
  };

  return { at, travel: total, options: { ...options, hue } };
}
