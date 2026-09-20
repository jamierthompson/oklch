import { contrast, inGamut } from "colorjs.io/fn";

import {
  GAMUT_EPSILON,
  assertColor,
  assertFinite,
  describe,
  toColorjs,
  type OkLCH,
} from "./color.js";

/**
 * Both meters are defined over sRGB: WCAG 2.x by its relative-luminance
 * formula, APCA by the published algorithm's own coefficients. A color
 * outside sRGB is refused by name. Measuring it anyway would score a color
 * the display cannot show, and the per-channel clamp inside the meter
 * flatters it — an unreported clip once turned a failing Lc 72.8 into a
 * passing 75.3.
 */
function assertMeasurable(fn: string, role: string, color: OkLCH): OkLCH {
  const c = assertColor(fn, role, color);
  if (!inGamut(toColorjs(c), "srgb", { epsilon: GAMUT_EPSILON })) {
    throw new RangeError(
      `${fn}: ${role} ${describe(c)} is outside sRGB, the gamut both contrast ` +
        `meters are defined over. gamutMap(color, "srgb") first and measure what ships.`,
    );
  }
  return c;
}

/**
 * What does this pairing measure, under WCAG 2.x?
 *
 * The conformance ratio, 1 to 21. Symmetric: swapping the colors gives the
 * same number, which is both its legal standing and its weakness. Refuses
 * out-of-sRGB input by name.
 */
export function contrastWCAG(text: OkLCH, background: OkLCH): number {
  const t = assertMeasurable("contrastWCAG", "text", text);
  const b = assertMeasurable("contrastWCAG", "background", background);
  return contrast(toColorjs(b), toColorjs(t), "WCAG21");
}

/**
 * What does this pairing measure, under APCA?
 *
 * Lightness contrast Lc, signed: positive for dark text on a light
 * background, negative for the reverse, about ±106 at the extremes. A
 * perceptual estimate and a candidate for WCAG 3, not conformance. Refuses
 * out-of-sRGB input by name.
 */
export function contrastAPCA(text: OkLCH, background: OkLCH): number {
  const t = assertMeasurable("contrastAPCA", "text", text);
  const b = assertMeasurable("contrastAPCA", "background", background);
  return contrast(toColorjs(b), toColorjs(t), "APCA");
}

/** A legibility bar: the WCAG ratio to conform to, and the APCA Lc magnitude to aim for. */
export interface ContrastTarget {
  readonly wcag: number;
  readonly apca: number;
}

/**
 * WCAG 2.2 AA floors, paired with the APCA level for the same role. "Large"
 * is 18pt, or 14pt bold. Nothing rounds toward these: a pairing clears a
 * target or it does not.
 */
export const CONTRAST_TARGETS = {
  bodyText: { wcag: 4.5, apca: 75 },
  largeText: { wcag: 3, apca: 45 },
  interfaceElement: { wcag: 3, apca: 30 },
} as const satisfies Record<string, ContrastTarget>;

export type ContrastTargetName = keyof typeof CONTRAST_TARGETS;

/** One meter's reading against its bar. */
export interface MeterReading {
  /** What the meter measured. For APCA this is the magnitude; see `polarity`. */
  readonly value: number;
  /** The bar it was measured against. */
  readonly target: number;
  /** `value - target`: how much room there is, or how far short it falls. */
  readonly margin: number;
  readonly passes: boolean;
}

/** Which way round APCA read the pairing. */
export type Polarity = "dark-on-light" | "light-on-dark" | "none";

/** What a pairing measures under both standards, and whether it clears both. */
export interface ContrastCheck {
  readonly wcag: MeterReading;
  readonly apca: MeterReading & { readonly polarity: Polarity };
  /** Both standards clear. Neither substitutes for the other. */
  readonly passes: boolean;
}

/**
 * Does this pairing clear?
 *
 * Both meters, each against its own bar, plus the margin on each. A pairing
 * passes only when both do: WCAG is the conformance requirement and APCA the
 * perceptual one. Refuses out-of-sRGB input by name, and a target that is
 * not a finite number.
 */
export function checkContrast(
  text: OkLCH,
  background: OkLCH,
  target: ContrastTarget,
): ContrastCheck {
  const t = assertMeasurable("checkContrast", "text", text);
  const b = assertMeasurable("checkContrast", "background", background);
  assertFinite("checkContrast", "target.wcag", target.wcag);
  assertFinite("checkContrast", "target.apca", target.apca);

  const wcag = contrast(toColorjs(b), toColorjs(t), "WCAG21");
  const lc = contrast(toColorjs(b), toColorjs(t), "APCA");
  const apca = Math.abs(lc);
  const polarity: Polarity =
    lc > 0 ? "dark-on-light" : lc < 0 ? "light-on-dark" : "none";

  const wcagReading: MeterReading = {
    value: wcag,
    target: target.wcag,
    margin: wcag - target.wcag,
    passes: wcag >= target.wcag,
  };
  const apcaReading = {
    value: apca,
    target: target.apca,
    margin: apca - target.apca,
    passes: apca >= target.apca,
    polarity,
  };
  return {
    wcag: wcagReading,
    apca: apcaReading,
    passes: wcagReading.passes && apcaReading.passes,
  };
}
