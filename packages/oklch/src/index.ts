/**
 * A thin contract over colorjs.io for OKLCH design work.
 *
 * colorjs.io does the math. This package decides what the math is allowed
 * to say: every function refuses by name, reports what moved, and never
 * clamps, rounds, or falls back.
 *
 * Tier 1 answers about one color or one pair. Tier 2 answers about a list
 * of steps, and is built from Tier 1's public surface alone — an
 * architectural test enforces it.
 */

export * from "./tier1.js";
export * from "./ramp.js";
export * from "./scale.js";
