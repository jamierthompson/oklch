/**
 * Tier 2: a list of steps. Nothing here is generated — the steps are the
 * OkLCH colors an eye placed, and these functions say what each one
 * measures and how the neighbours relate. Built from Tier 1 alone.
 */

import {
  checkContrast,
  contrastAPCA,
  contrastWCAG,
  deltaEOK,
  GAMUTS,
  gamutMap,
  maxChroma,
  type ContrastCheck,
  type ContrastTarget,
  type Gamut,
  type GamutMapReport,
  type OkLCH,
} from "./tier1.js";

/** What one placed step measures. */
export interface RampStep {
  readonly index: number;
  /** The step as placed, hue wrapped. */
  readonly requested: OkLCH;
  /** The step mapped into the gamut that ships, and what that moved. */
  readonly map: GamutMapReport;
  /** What ships: `map.color`. */
  readonly color: OkLCH;
  /** What non-P3 screens should get: `color` mapped into sRGB. */
  readonly fallback: GamutMapReport;
  /** The safe-prefix chroma at this step's lightness and hue, in the gamut. */
  readonly maxChroma: number;
  /** `color.C` as a share of `maxChroma`; 0 where no chroma fits. */
  readonly chromaShare: number;
  /** Whether the shipped chroma sits on the gamut boundary (within 0.001 of `maxChroma`). */
  readonly onCusp: boolean;
  /** Both meters against white and black, measured on the sRGB fallback. */
  readonly contrast: {
    readonly onWhite: { readonly wcag: number; readonly apca: number };
    readonly onBlack: { readonly wcag: number; readonly apca: number };
  };
}

/** The relation between two neighbouring steps, measured on what ships. */
export interface RampGap {
  readonly from: number;
  readonly to: number;
  readonly deltaEOK: number;
  readonly deltaL: number;
  /** `deltaEOK` as a multiple of the ramp's mean gap: under 1 is bunched, over 1 is stretched. */
  readonly shareOfMean: number;
}

/** How lightness travels along the ramp. */
export type LightnessDirection = "increasing" | "decreasing" | "flat" | "mixed";

export interface RampReport {
  readonly gamut: Gamut;
  readonly steps: readonly RampStep[];
  /** One gap per neighbouring pair; empty for a single step. */
  readonly gaps: readonly RampGap[];
  readonly lightness: { readonly direction: LightnessDirection };
  readonly spacing: {
    /** Mean ΔEOK between neighbours; 0 for a single step. */
    readonly mean: number;
    /** Index into `gaps` of the tightest and widest gap, or null for a single step. */
    readonly tightest: number | null;
    readonly widest: number | null;
  };
}

const WHITE: OkLCH = { L: 1, C: 0, H: 0 };
const BLACK: OkLCH = { L: 0, C: 0, H: 0 };
const CUSP_TOLERANCE = 0.001;

/**
 * What does each step I placed measure, and how do the neighbours relate?
 *
 * Per step: the map into the gamut and what it moved, the sRGB fallback,
 * chroma as a share of what the gamut allows there, whether it sits on the
 * boundary, and both contrast meters against white and black. Between
 * steps, the one thing Tier 1 cannot see: ΔEOK to each neighbour, whether
 * lightness runs one way, and where the spacing bunches.
 *
 * Steps carry L, C and H each; a hue that drifts across a ramp is a choice
 * to make and measure, not a policy. Throws on an empty list, a non-finite
 * channel, negative chroma, or a missing gamut.
 */
export function inspectRamp(steps: readonly OkLCH[], gamut: Gamut): RampReport {
  if (steps.length === 0) {
    throw new RangeError(
      "inspectRamp: the ramp is empty; there is nothing to measure",
    );
  }
  if (!GAMUTS.includes(gamut)) {
    throw new TypeError(
      `inspectRamp: gamut is ${String(gamut)}; pass "srgb" or "p3". There is no default.`,
    );
  }

  const inspected: RampStep[] = steps.map((placed, index) => {
    const map = gamutMap(placed, gamut);
    const color = map.color;
    const fallback = gamutMap(color, "srgb");
    const max = maxChroma(color.L, color.H, gamut);
    const chromaShare = max === 0 ? 0 : color.C / max;
    return {
      index,
      requested: map.requested,
      map,
      color,
      fallback,
      maxChroma: max,
      chromaShare,
      onCusp: max > 0 && Math.abs(color.C - max) <= CUSP_TOLERANCE,
      contrast: {
        onWhite: {
          wcag: contrastWCAG(fallback.color, WHITE),
          apca: contrastAPCA(fallback.color, WHITE),
        },
        onBlack: {
          wcag: contrastWCAG(fallback.color, BLACK),
          apca: contrastAPCA(fallback.color, BLACK),
        },
      },
    };
  });

  const distances = inspected.slice(1).map((step, i) => ({
    from: i,
    to: i + 1,
    deltaEOK: deltaEOK(inspected[i]!.color, step.color),
    deltaL: step.color.L - inspected[i]!.color.L,
  }));
  const mean =
    distances.length === 0
      ? 0
      : distances.reduce((sum, gap) => sum + gap.deltaEOK, 0) /
        distances.length;
  const gaps: RampGap[] = distances.map((gap) => ({
    ...gap,
    shareOfMean: mean === 0 ? 0 : gap.deltaEOK / mean,
  }));

  const signs = new Set(gaps.map((gap) => Math.sign(gap.deltaL)));
  const direction: LightnessDirection =
    gaps.length === 0 || (signs.size === 1 && signs.has(0))
      ? "flat"
      : signs.size === 1 && signs.has(1)
        ? "increasing"
        : signs.size === 1 && signs.has(-1)
          ? "decreasing"
          : "mixed";

  const extreme = (pick: (a: RampGap, b: RampGap) => boolean): number | null =>
    gaps.length === 0
      ? null
      : gaps.reduce((best, gap, i) => (pick(gap, gaps[best]!) ? i : best), 0);

  return {
    gamut,
    steps: inspected,
    gaps,
    lightness: { direction },
    spacing: {
      mean,
      tightest: extreme((a, b) => a.deltaEOK < b.deltaEOK),
      widest: extreme((a, b) => a.deltaEOK > b.deltaEOK),
    },
  };
}

/** Which end of the ramp a walk starts from. */
export type RampEnd = "start" | "end";

export interface MinPassOptions {
  /** Walk from the first step (`"start"`, the default) or the last (`"end"`). */
  readonly from?: RampEnd;
}

export interface MinPass {
  /** Index into the ramp, as given, of the first step that clears. */
  readonly index: number;
  readonly color: OkLCH;
  readonly check: ContrastCheck;
  /** Every step's measurement, in ramp order, so the ones that failed are visible too. */
  readonly checks: readonly ContrastCheck[];
  readonly from: RampEnd;
}

/**
 * Which is the first step that clears on this surface?
 *
 * Walks the ramp from `from` — its first step by default, or its last with
 * `{ from: "end" }`, which is what a dark scheme wants of a ramp listed
 * light to dark — and returns the first step whose pairing with
 * `background` clears `target` under both standards, with every step's
 * measurement alongside. Throws on an empty ramp rather than returning
 * `undefined`, and by name when no step clears. The meters refuse
 * out-of-sRGB steps; pass what ships — `inspectRamp(...).steps.map((s) =>
 * s.fallback.color)` for a P3 ramp.
 */
export function minPass(
  ramp: readonly OkLCH[],
  background: OkLCH,
  target: ContrastTarget,
  options: MinPassOptions = {},
): MinPass {
  const from = options.from ?? "start";
  if (from !== "start" && from !== "end") {
    throw new TypeError(
      `minPass: from is ${String(from)}; pass "start" or "end"`,
    );
  }
  if (ramp.length === 0) {
    throw new RangeError(
      "minPass: the ramp is empty; there is no step to clear",
    );
  }
  const checks = ramp.map((step) => checkContrast(step, background, target));
  const index =
    from === "start"
      ? checks.findIndex((c) => c.passes)
      : checks.findLastIndex((c) => c.passes);
  if (index === -1) {
    throw new RangeError(
      `minPass: none of the ${ramp.length} steps clears the target ` +
        `(WCAG ${target.wcag}, APCA ${target.apca}) on oklch(${background.L} ${background.C} ${background.H})`,
    );
  }
  return { index, color: ramp[index]!, check: checks[index]!, checks, from };
}
