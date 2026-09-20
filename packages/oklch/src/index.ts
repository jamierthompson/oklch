/**
 * A thin contract over colorjs.io for OKLCH design work.
 *
 * colorjs.io does the math. This package decides what the math is allowed
 * to say: every function refuses by name, reports what moved, and never
 * clamps, rounds, or falls back.
 */

export {
  GAMUTS,
  GAMUT_EPSILON,
  wrapHue,
  type Gamut,
  type OkLCH,
} from "./color.js";
export { parseColor } from "./parse.js";
export {
  gamutMap,
  hueArc,
  inGamut,
  maxChroma,
  type GamutMapReport,
} from "./gamut.js";
export { deltaEOK } from "./distance.js";
export {
  CONTRAST_TARGETS,
  checkContrast,
  contrastAPCA,
  contrastWCAG,
  type ContrastCheck,
  type ContrastTarget,
  type ContrastTargetName,
  type MeterReading,
  type Polarity,
} from "./contrast.js";
export {
  solveBackground,
  solveForeground,
  type Ink,
  type LightnessRange,
  type SolveBackgroundOptions,
  type SolveForegroundOptions,
  type Solved,
  type SolvedBackground,
  type SolvedForeground,
} from "./solve.js";
export {
  HARMONY_KINDS,
  harmony,
  rotateHue,
  type Harmony,
  type HarmonyKind,
} from "./hue.js";
export { formatHex, formatOklch, type HexReport } from "./format.js";
