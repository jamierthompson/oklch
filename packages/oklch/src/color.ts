/**
 * The boundary between this package and colorjs.io.
 *
 * colorjs.io does the math. Everything in this file decides what the math is
 * allowed to say: which spaces exist, what a color is, and which inputs are
 * refused before any arithmetic happens.
 */

import {
  ColorSpace,
  OKLCH,
  OKLab,
  P3,
  P3_Linear,
  XYZ_D65,
  sRGB,
  sRGB_Linear,
  type PlainColorObject,
} from "colorjs.io/fn";

// The tree-shakeable API registers nothing by itself. These are the only
// spaces this package reaches: OkLCH and its base, the two display gamuts and
// their linear forms, and the XYZ connection space between them.
for (const space of [XYZ_D65, sRGB_Linear, sRGB, P3_Linear, P3, OKLab, OKLCH]) {
  ColorSpace.register(space);
}

/**
 * An opaque color in OkLCH. Channels are unclamped: a color may name a point
 * no display can show, and every gamut-aware function takes the gamut to ask
 * about.
 */
export interface OkLCH {
  /** Perceived lightness, 0 (black) to 1 (white). */
  readonly L: number;
  /** Distance from the gray axis; 0 is achromatic. An amount: never negative. */
  readonly C: number;
  /** Hue angle in degrees. Accepted at any finite angle, reported in [0, 360). */
  readonly H: number;
}

/** A display gamut. P3 is first-class; sRGB is what every other screen gets. */
export type Gamut = "srgb" | "p3";

/** The legal values of {@link Gamut}, for messages and UIs. */
export const GAMUTS: readonly Gamut[] = ["srgb", "p3"];

/**
 * colorjs.io's own in-gamut tolerance, in the gamut's channel units
 * (7.5e-5 of a channel, about 0.02 of one 8-bit step). Passed explicitly at
 * every call so the policy is this package's, not a default it inherited.
 */
export const GAMUT_EPSILON = 0.000075;

/** Wrap any finite angle into [0, 360). Angles are periodic: -30 names 330. */
export function wrapHue(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360;
  // Adding 360 to a hue just below zero can round to exactly 360.
  return wrapped === 360 ? 0 : wrapped;
}

/**
 * Refuse a color this package cannot reason about, naming the channel and the
 * legal alternative. Returns the color with its hue wrapped.
 */
export function assertColor(fn: string, role: string, color: OkLCH): OkLCH {
  for (const channel of ["L", "C", "H"] as const) {
    if (!Number.isFinite(color[channel])) {
      throw new RangeError(
        `${fn}: ${role} channel ${channel} is ${String(color[channel])}, not a finite number`,
      );
    }
  }
  if (color.C < 0) {
    throw new RangeError(
      `${fn}: ${role} chroma ${color.C} is negative, and chroma is an amount. ` +
        `If the opposite-hue point was meant, pass { C: ${-color.C}, H: ${wrapHue(color.H + 180)} }.`,
    );
  }
  return { L: color.L, C: color.C, H: wrapHue(color.H) };
}

/** Refuse a gamut that is not one of the two this package answers for. */
export function assertGamut(fn: string, gamut: unknown): Gamut {
  if (gamut === "srgb" || gamut === "p3") return gamut;
  throw new TypeError(
    `${fn}: gamut is ${String(gamut)}; pass "srgb" or "p3". There is no default, ` +
      `because the answer differs by screen.`,
  );
}

/** Refuse a number that cannot take part in a calculation. */
export function assertFinite(fn: string, name: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(
      `${fn}: ${name} is ${String(value)}, not a finite number`,
    );
  }
  return value;
}

/** A fresh colorjs.io object. Fresh matters: colorjs.io's toGamut mutates. */
export function toColorjs(color: OkLCH): PlainColorObject {
  return { space: OKLCH, coords: [color.L, color.C, color.H], alpha: 1 };
}

/**
 * Back from colorjs.io. An achromatic color comes back with hue `none`; CSS
 * defines `none` as 0 for calculation, and that is the only normalization
 * this package performs.
 */
export function fromColorjs(color: PlainColorObject): OkLCH {
  const [L, C, H] = color.coords;
  return { L: L ?? 0, C: C ?? 0, H: wrapHue(H ?? 0) };
}

/** A color's name in an error message. */
export function describe(color: OkLCH): string {
  return `oklch(${color.L} ${color.C} ${color.H})`;
}
