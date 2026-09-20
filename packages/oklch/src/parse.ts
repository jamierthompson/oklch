import { parse, to } from "colorjs.io/fn";

import { wrapHue, type OkLCH } from "./color.js";

/**
 * What did I type?
 *
 * Any CSS color string colorjs.io can read, normalized to OkLCH. Returns
 * `null` for anything else: a parser's domain is untrusted strings, so bad
 * input is expected, not exceptional. This is the one place in the package
 * that returns instead of throwing.
 *
 * Also `null`, by contract rather than by accident:
 * - a translucent color: alpha has no OkLCH channel to live in, and dropping
 *   it silently would ship a different color than the one typed;
 * - negative chroma: an amount, not a coordinate — `oklch(0.5 -0.1 30)` is
 *   refused rather than repaired to `oklch(0.5 0.1 210)`;
 * - a non-finite channel.
 *
 * Hue is wrapped into [0, 360), because -30 and 330 are the same angle.
 * `none` channels read as 0, which is what CSS defines for calculation.
 */
export function parseColor(input: unknown): OkLCH | null {
  if (typeof input !== "string") return null;

  let converted;
  try {
    converted = to(parse(input), "oklch");
  } catch {
    return null;
  }

  // colorjs.io reports a missing alpha as 1 and `none` alpha as null.
  const alpha = converted.alpha ?? 0;
  if (alpha !== 1) return null;

  const [L, C, H] = converted.coords;
  const color = { L: L ?? 0, C: C ?? 0, H: H ?? 0 };
  if (
    !Number.isFinite(color.L) ||
    !Number.isFinite(color.C) ||
    !Number.isFinite(color.H)
  ) {
    return null;
  }
  if (color.C < 0) return null;

  return { L: color.L, C: color.C, H: wrapHue(color.H) };
}
