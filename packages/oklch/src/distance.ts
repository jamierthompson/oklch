import { deltaE } from "colorjs.io/fn";

import { assertColor, toColorjs, type OkLCH } from "./color.js";

/**
 * How far is this step from its neighbour?
 *
 * Perceived difference: Euclidean distance in OKLab, which is what OKLab was
 * fit so that distance would mean. One just-noticeable difference is 0.02.
 * Throws on a non-finite channel or negative chroma rather than reporting
 * `NaN` as though it were a distance.
 */
export function deltaEOK(a: OkLCH, b: OkLCH): number {
  const first = assertColor("deltaEOK", "first", a);
  const second = assertColor("deltaEOK", "second", b);
  return deltaE(toColorjs(first), toColorjs(second), "OK");
}
