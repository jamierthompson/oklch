import {
  assertColor,
  assertFinite,
  assertGamut,
  wrapHue,
  type Gamut,
  type OkLCH,
} from "./color.js";
import { gamutMap, type GamutMapReport } from "./gamut.js";

/**
 * What's this color at another hue?
 *
 * Sets the hue, holding lightness and chroma, then gamut-maps: the same
 * chroma is not available at every hue, so the rotated color may not be
 * displayable and the map's move is part of the answer. Angles wrap, so any
 * finite rotation is legal. Throws on a non-finite rotation or channel, or a
 * missing gamut.
 */
export function rotateHue(
  color: OkLCH,
  degrees: number,
  gamut: Gamut,
): GamutMapReport {
  const c = assertColor("rotateHue", "color", color);
  assertFinite("rotateHue", "degrees", degrees);
  const g = assertGamut("rotateHue", gamut);
  return gamutMap({ L: c.L, C: c.C, H: wrapHue(c.H + degrees) }, g);
}

/** Color-theory relationships and their hue offsets from the seed, in degrees. */
export const HARMONY_KINDS = {
  /** The opposite hue. */
  complementary: [180],
  /** The neighbors on the wheel. */
  analogous: [-30, 30],
  /** Three hues at even thirds. */
  triadic: [-120, 120],
  /** The complementary's neighbors. */
  "split-complementary": [150, 210],
  /** Four hues at even quarters: the square. */
  tetradic: [90, 180, 270],
} as const satisfies Record<string, readonly number[]>;

export type HarmonyKind = keyof typeof HARMONY_KINDS;

export interface Harmony {
  readonly kind: HarmonyKind;
  /** The seed, hue wrapped. Not gamut-mapped: it is the caller's color as given. */
  readonly seed: OkLCH;
  /** The offsets applied, in the order of `colors`. */
  readonly offsets: readonly number[];
  /** One report per offset: the rotated color, mapped, with its move. */
  readonly colors: readonly GamutMapReport[];
}

/**
 * Which hues are in harmony with this one?
 *
 * Each derived color is the seed rotated by the relationship's offsets and
 * gamut-mapped. Takes a valid OkLCH: the caller parses, and there is no
 * fallback seed. Throws on a kind that is not color-theory vocabulary, a
 * non-finite channel, or a missing gamut.
 */
export function harmony(seed: OkLCH, kind: HarmonyKind, gamut: Gamut): Harmony {
  const s = assertColor("harmony", "seed", seed);
  const g = assertGamut("harmony", gamut);
  if (!Object.hasOwn(HARMONY_KINDS, kind)) {
    throw new TypeError(
      `harmony: kind is ${String(kind)}; pass one of ${Object.keys(HARMONY_KINDS).join(", ")}`,
    );
  }
  const offsets = HARMONY_KINDS[kind];
  return {
    kind,
    seed: s,
    offsets,
    colors: offsets.map((degrees) => rotateHue(s, degrees, g)),
  };
}
