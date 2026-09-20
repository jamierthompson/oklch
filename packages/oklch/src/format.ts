import { deltaE, inGamut, parse, serialize, to } from "colorjs.io/fn";

import {
  GAMUT_EPSILON,
  assertColor,
  describe,
  fromColorjs,
  toColorjs,
  type OkLCH,
} from "./color.js";

/**
 * What does the stylesheet get?
 *
 * A CSS `oklch()` string whose numerals are the channel values exactly: the
 * emitted string is the computed color, and parsing it back returns the
 * same doubles. colorjs.io's serializer cannot promise that — it gamut-maps
 * by default, rounds to five significant digits by default, and even at 17
 * digits its rounding step (`floor(n × 10^17 + 0.5) / 10^17`) loses the
 * last bit of a double — so this function does not use it. JavaScript's own
 * shortest round-trip form is exact by definition, and CSS accepts its
 * exponent notation for tiny magnitudes.
 *
 * Throws on a non-finite channel: there is no valid CSS to make from one,
 * and a browser drops an invalid declaration without a word.
 */
export function formatOklch(color: OkLCH): string {
  const c = assertColor("formatOklch", "color", color);
  return `oklch(${String(c.L)} ${String(c.C)} ${String(c.H)})`;
}

/** What a hex-only consumer gets, and what it cost. */
export interface HexReport {
  /** Six-digit lowercase hex. */
  readonly hex: string;
  /** The color the hex actually names, in OkLCH: each channel rounded to 8 bits. */
  readonly color: OkLCH;
  /** Perceived distance between the hex and the color asked for, in ΔEOK. */
  readonly deltaEOK: number;
}

/**
 * What does a hex-only consumer get?
 *
 * Hex is 8-bit sRGB: it cannot hold a P3 color, so out-of-sRGB input is
 * refused by name — map first, then format what ships. Within sRGB the only
 * loss is 8-bit quantization, and the report says how much that was.
 */
export function formatHex(color: OkLCH): HexReport {
  const c = assertColor("formatHex", "color", color);
  if (!inGamut(toColorjs(c), "srgb", { epsilon: GAMUT_EPSILON })) {
    throw new RangeError(
      `formatHex: ${describe(c)} is outside sRGB, and hex cannot hold it. ` +
        `gamutMap(color, "srgb") first and format what ships.`,
    );
  }
  const hex = serialize(toColorjs(c), {
    format: "hex",
    collapse: false,
    inGamut: false,
  });
  const shipped = fromColorjs(to(parse(hex), "oklch"));
  return {
    hex,
    color: shipped,
    deltaEOK: deltaE(toColorjs(c), toColorjs(shipped), "OK"),
  };
}
