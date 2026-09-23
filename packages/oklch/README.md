# @jamiethompson/oklch

A thin contract over [colorjs.io](https://colorjs.io) for OKLCH design work.
colorjs.io does the math; this package decides what the math is allowed to
say. Every function refuses by name, reports what moved, and never clamps,
rounds, or falls back. P3 is first-class, and every gamut-aware function
takes the gamut explicitly.

```bash
pnpm add @jamiethompson/oklch
```

```ts
import { createRamp, minPass, CONTRAST_TARGETS } from "@jamiethompson/oklch";

const ramp = createRamp({ through: seed, gamut: "srgb" });
const ink = minPass(ramp.steps, surface, CONTRAST_TARGETS.bodyText);
```

Three tiers, each built from the one below through its public surface only:

| Tier | What it answers                                                         |
| ---- | ----------------------------------------------------------------------- |
| 1    | One color or one pair: parse, gamut, distance, contrast, solve, hue.    |
| 2    | A list of steps: draft a ramp, inspect one, find the first that clears. |
| 3    | A whole system: bind steps to roles with a receipt per pairing, ship.   |

Part of [OKLCH Studio](https://github.com/jamierthompson/oklch), a theme studio
for shadcn/ui. The architecture and contract are in
[docs/concepts/architecture.md](https://github.com/jamierthompson/oklch/blob/main/docs/concepts/architecture.md).

MIT
