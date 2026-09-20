# oklch

A thin contract over [colorjs.io](https://colorjs.io) for OKLCH design work.
Every function refuses by name, reports what moved, and never clamps, rounds, or
falls back.

colorjs.io does the math. This package decides what the math is allowed to say.

## Install

```bash
pnpm add @jamiethompson/oklch
```

## What it answers

Tier 1: one color, or one pair. P3 is first-class and sRGB is the fallback; every
gamut-aware function takes the gamut, and a missing one throws.

| Function                              | The question it answers                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `parseColor(string)`                  | What did I type?                                                   |
| `maxChroma(L, H, gamut)`              | How vivid can this step be?                                        |
| `inGamut(color, gamut)`               | Is this displayable on this screen?                                |
| `gamutMap(color, gamut)`              | Where does it land if not?                                         |
| `deltaEOK(a, b)`                      | How far is this step from its neighbour?                           |
| `contrastWCAG` / `contrastAPCA`       | What does this pairing measure?                                    |
| `checkContrast(text, bg, target)`     | Does this pairing clear?                                           |
| `solveBackground(text, target, opts)` | I've placed an ink — how far can the surface move before it fails? |
| `solveForeground(bg, target, opts)`   | I've placed a surface — what's the nearest ink that clears on it?  |
| `rotateHue(color, degrees, gamut)`    | What's this color at another hue?                                  |
| `harmony(seed, kind, gamut)`          | Which hues are in harmony with this one?                           |
| `formatOklch(color)`                  | What does the stylesheet get?                                      |
| `formatHex(color)`                    | What does a hex-only consumer get?                                 |

```ts
import {
  CONTRAST_TARGETS,
  gamutMap,
  parseColor,
  solveForeground,
} from "@jamiethompson/oklch";

const surface = parseColor("oklch(0.7 0.1 150)"); // null if it isn't a color
if (surface === null) throw new Error("not a color");

// What does a non-P3 screen get? A report, not a bare color.
const fallback = gamutMap(surface, "srgb");
fallback.moved; // false — this one fits

// Nearest ink that clears body text, toward both poles. No guessed direction.
const ink = solveForeground(surface, CONTRAST_TARGETS.bodyText, {
  ink: { C: 0.1, H: 150 },
  gamut: "p3",
});
ink.toward.light; // null — nothing light enough clears on this surface
ink.toward.dark?.check.apca.margin; // how much room the dark ink has
```

## Posture

- **Parsers return null. Everything else throws by name**, naming the violation
  and the legal alternative.
- **Angles wrap, amounts refuse.** Hue −30 is 330; chroma −0.1 is an error.
- **Map, never clip; map before measuring.** The contrast meters refuse
  out-of-sRGB input.
- **No rounding, no normalization** between what was asked and what ships.
  colorjs.io's defaults do both; every call site opts out.
- **Every output is a report.** The library never signs off.

See [docs/concepts/architecture.md](docs/concepts/architecture.md).

## Develop

```bash
pnpm install
pnpm dev     # one example page per function, at http://localhost:5173
pnpm test    # contract tests
pnpm gate    # format, lint, typecheck, test, build — what CI runs
```

## Structure

- `packages/oklch` — the library. Its only dependency is colorjs.io.
- `examples` — one Vite page per function, each showing when you'd reach for it.
- `docs/concepts` — the architecture and the contract.

## License

MIT
