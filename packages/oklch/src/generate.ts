/**
 * Tier 2: a generated ramp. A draft the eye then moves, never a palette
 * the package signs off on. Built from Tier 1 alone.
 */

import { GAMUTS, maxChroma, wrapHue, type Gamut, type OkLCH } from "./tier1.js";

/**
 * The lightness stops of Tailwind CSS v4's palette, light to dark, read from
 * its published `theme.css`. Chromatic ramps share one set; the neutral
 * ramps run darker at the end. Eleven stops named 50 to 950.
 */
export const TAILWIND_STOPS = {
  names: [
    "50",
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
    "950",
  ],
  chromatic: [
    0.97, 0.935, 0.885, 0.81, 0.705, 0.63, 0.56, 0.495, 0.435, 0.385, 0.27,
  ],
  neutral: [
    0.985, 0.97, 0.922, 0.87, 0.708, 0.556, 0.439, 0.371, 0.269, 0.205, 0.145,
  ],
} as const satisfies {
  names: readonly string[];
  chromatic: readonly number[];
  neutral: readonly number[];
};

interface RampBase {
  /**
   * Lightness of each step, in ramp order, strictly rising or strictly
   * falling. Default `TAILWIND_STOPS.chromatic`.
   */
  readonly lightness?: readonly number[];
  /** Degrees of hue drift from the first step to the last. Default 0. */
  readonly hueShift?: number;
  readonly gamut: Gamut;
}

/** A ramp drawn at a hue, with chroma a fraction of what the gamut allows at each step. */
export interface RampFromHue extends RampBase {
  /** Any finite angle; wraps. */
  readonly hue: number;
  /** Fraction of the safe-prefix chroma at each step, 0 to 1. An amount: refused outside that range. */
  readonly saturation: number;
  readonly through?: undefined;
}

/** A ramp drawn through a brand color: its hue, its share of the gamut, and one step placed on it exactly. */
export interface RampThrough extends RampBase {
  readonly through: OkLCH;
  readonly hue?: undefined;
  readonly saturation?: undefined;
}

export type RampOptions = RampFromHue | RampThrough;

export interface GeneratedRamp {
  /** The steps, in the order of `lightness`. A draft: pass them to `inspectRamp`, then move them. */
  readonly steps: readonly OkLCH[];
  /** The hue at the anchor, wrapped. */
  readonly hue: number;
  /** The fraction of the safe prefix used at every step; derived from `through` when one was given. */
  readonly saturation: number;
  /** The lightness stops actually used, with the `through` step's lightness substituted where it landed. */
  readonly lightness: readonly number[];
  /** The step placed on the brand color, or null when the ramp was drawn from a hue. */
  readonly through: { readonly index: number; readonly color: OkLCH } | null;
  readonly gamut: Gamut;
}

function assertLightness(fn: string, stops: readonly number[]): void {
  if (stops.length === 0) {
    throw new RangeError(`${fn}: lightness has no stops; a ramp needs one`);
  }
  stops.forEach((L, i) => {
    if (!Number.isFinite(L)) {
      throw new RangeError(
        `${fn}: lightness[${i}] is ${String(L)}, not a finite number`,
      );
    }
    if (L < 0 || L > 1) {
      throw new RangeError(
        `${fn}: lightness[${i}] ${L} is outside [0, 1]; no display shows a color there`,
      );
    }
  });
  const direction = stops.length < 2 ? 0 : Math.sign(stops[1]! - stops[0]!);
  for (let i = 1; i < stops.length; i += 1) {
    const step = Math.sign(stops[i]! - stops[i - 1]!);
    if (step === 0 || step !== direction) {
      throw new RangeError(
        `${fn}: lightness runs ${stops[i - 1]} then ${stops[i]} at steps ${i - 1} and ${i}; ` +
          `a ramp's lightness runs one way, strictly. Reorder the stops, or drop one.`,
      );
    }
  }
}

/**
 * A ramp to start from.
 *
 * One hue, lightness stepping through the stops given (Tailwind's by
 * default), chroma at each step a fixed fraction of the safe-prefix chroma
 * the gamut allows there. Because `maxChroma` peaks at the gamut's cusp and
 * falls to nothing at black and white, the ramp is vivid in the middle and
 * quiet at the ends by construction, and every step is inside the gamut.
 * `hueShift` drifts the hue linearly across the ramp, from the anchor.
 *
 * With `through`, the ramp is drawn through a brand color instead: its hue
 * is the ramp's, its chroma as a share of the safe prefix at its lightness
 * is the ramp's saturation, and the stop nearest its lightness is replaced
 * by that lightness, so the brand color is a step, exactly. A brand color
 * beyond the safe prefix is refused by name rather than desaturated: map
 * it first, or draw the ramp for the gamut it fits.
 *
 * What comes out is steps, nothing more. Measure them with `inspectRamp`,
 * move the ones the eye disagrees with, and bind them as any placed ramp.
 * The package generates the draft and signs off on nothing.
 *
 * Refuses a missing gamut, non-finite options, saturation outside [0, 1],
 * lightness stops outside [0, 1] or not strictly one-way, `hue` together
 * with `through`, and neither.
 */
export function createRamp(options: RampOptions): GeneratedRamp {
  const fn = "createRamp";
  if (!GAMUTS.includes(options.gamut)) {
    throw new TypeError(
      `${fn}: gamut is ${String(options.gamut)}; pass "srgb" or "p3". There is no default.`,
    );
  }
  const { gamut } = options;
  const hueShift = options.hueShift ?? 0;
  if (!Number.isFinite(hueShift)) {
    throw new RangeError(
      `${fn}: hueShift is ${String(hueShift)}, not a finite number`,
    );
  }
  const fromHue = options.hue !== undefined || options.saturation !== undefined;
  if (fromHue && options.through !== undefined) {
    throw new TypeError(
      `${fn}: both \`hue\`/\`saturation\` and \`through\` were given; ` +
        `\`through\` supplies the hue and saturation, so pass one or the other`,
    );
  }
  if (!fromHue && options.through === undefined) {
    throw new TypeError(
      `${fn}: pass \`hue\` and \`saturation\` to draw a ramp, or \`through\` to draw one through a color`,
    );
  }

  const given = options.lightness ?? TAILWIND_STOPS.chromatic;
  assertLightness(fn, given);
  const lightness = [...given];

  let hue: number;
  let saturation: number;
  let anchor: number | null = null;
  let through: GeneratedRamp["through"] = null;

  if (options.through !== undefined) {
    const t = options.through;
    for (const channel of ["L", "C", "H"] as const) {
      if (!Number.isFinite(t[channel])) {
        throw new RangeError(
          `${fn}: through channel ${channel} is ${String(t[channel])}, not a finite number`,
        );
      }
    }
    if (t.C < 0) {
      throw new RangeError(
        `${fn}: through chroma ${t.C} is negative, and chroma is an amount`,
      );
    }
    if (t.L < 0 || t.L > 1) {
      throw new RangeError(
        `${fn}: through lightness ${t.L} is outside [0, 1]; no display shows a color there`,
      );
    }
    hue = wrapHue(t.H);
    const max = maxChroma(t.L, hue, gamut);
    if (t.C > max) {
      throw new RangeError(
        `${fn}: through oklch(${t.L} ${t.C} ${hue}) sits beyond the safe chroma ${max} at that lightness in ${gamut}; ` +
          `gamutMap it into ${gamut} first, or draw the ramp for a gamut it fits`,
      );
    }
    saturation = max === 0 ? 0 : t.C / max;
    anchor = lightness.reduce(
      (best, L, i) =>
        Math.abs(L - t.L) < Math.abs(lightness[best]! - t.L) ? i : best,
      0,
    );
    lightness[anchor] = t.L;
    through = { index: anchor, color: { L: t.L, C: t.C, H: hue } };
  } else {
    if (!Number.isFinite(options.hue)) {
      throw new RangeError(
        `${fn}: hue is ${String(options.hue)}, not a finite number`,
      );
    }
    if (!Number.isFinite(options.saturation)) {
      throw new RangeError(
        `${fn}: saturation is ${String(options.saturation)}, not a finite number`,
      );
    }
    if (options.saturation! < 0 || options.saturation! > 1) {
      throw new RangeError(
        `${fn}: saturation ${options.saturation} is outside [0, 1]; it is a fraction of the ` +
          `chroma available at each lightness, and there is no chroma beyond the boundary to use`,
      );
    }
    hue = wrapHue(options.hue!);
    saturation = options.saturation!;
  }

  const span = lightness.length - 1;
  const origin = anchor === null ? 0 : anchor;
  const steps: OkLCH[] = lightness.map((L, i) => {
    const H = wrapHue(
      hue + (span === 0 ? 0 : (hueShift * (i - origin)) / span),
    );
    return { L, C: saturation * maxChroma(L, H, gamut), H };
  });
  if (through !== null) steps[through.index] = through.color;

  return { steps, hue, saturation, lightness, through, gamut };
}
