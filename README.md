# oklch

A thin contract over [colorjs.io](https://colorjs.io) for OKLCH design work.
Every function refuses by name, reports what moved, and never clamps, rounds, or
falls back.

colorjs.io does the math. This package decides what the math is allowed to say.
It drafts a ramp the eye then moves, binds the steps to the roles a system
needs — shadcn/ui's, out of the box — and gives every pairing a verdict with its
standard named. It never signs off.

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

Tier 2: a list of steps. Built from Tier 1's public surface alone, and an
architectural test in `tests/` fails if it imports anything else.

| Function                    | The question it answers                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `inspectRamp(steps, gamut)` | What does each step I placed measure, and how do the neighbours relate? |
| `minPass(ramp, bg, target)` | Which is the first step that clears on this surface?                    |
| `createScale(options)`      | Equal steps in data → equal perceived steps? (for data, not palettes)   |
| `createRamp(options)`       | A ramp to start from: a draft through a hue or a brand color, in gamut  |

Tier 3: a whole system. Steps bound to semantic roles, with a receipt per
pairing, and shipped.

| Function                            | The question it answers                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `resolveBinding(binding, context)`  | Bind one token: pick a step by eye, or solve for the first that clears.  |
| `buildTokenSet(spec)`               | Bind these ramps to these roles, in both schemes: a set, or a refusal.   |
| `auditTokenSet(spec)`               | Every token's verdict, without a refusal ending the walk. For an editor. |
| `shadcnBindings(assignment, ramps)` | shadcn/ui's variables bound to these ramps, in both schemes.             |
| `tokenSetToDeclarations(set)`       | What does this ship as, in plain CSS?                                    |
| `tokenSetToTailwindTheme(set)`      | What does this ship as, for Tailwind v4?                                 |
| `tokenSetToDesignTokens(set)`       | What does this ship as, for a token pipeline?                            |

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

## The studio

`apps/studio` is the tool the library exists for: a brand color in, shadcn's
theme out, with every step still the eye's to move. It opens empty: pick one of
a few seed colors or type your own, and it drafts a tinted neutral,
the brand ramp through the color, and a red; binds all 31 shadcn variables;
shows a verdict per token in both schemes, with real shadcn components skinned
by the palette as it stands; and ships the set as shadcn CSS, a `registry:theme`
item, or DTCG tokens once every pairing clears. Brands persist in the browser
and travel as JSON files.

## The brand file and the CLI

`@jamiethompson/oklch-brand` is the document the studio edits, as a package:
the ramps, which ramp plays which role, and the eye's overrides, with pure
functions from it to bindings, a verdict per token, and the files that ship.
Save a brand from the studio, commit it next to your app, and let the CLI
regenerate the theme in CI:

```bash
pnpm add -D @jamiethompson/oklch-brand
pnpm oklch-brand check acme.oklch.json          # a verdict per token; exit 1 unless all clear
pnpm oklch-brand build acme.oklch.json -o src   # acme.css, acme.registry.json, acme.tokens.json
```

Nothing is written unless every token clears. There is no fallback color.

## Develop

```bash
pnpm install
pnpm dev            # the studio, at http://localhost:5173
pnpm dev:examples   # one example page per library function
pnpm test           # contract tests, and the studio's model tests
pnpm gate           # format, lint, typecheck, test, build — what CI runs
```

## Structure

- `packages/oklch` — the library. Its only dependency is colorjs.io.
- `packages/brand` — the brand document and the `oklch-brand` CLI.
- `apps/studio` — the brand palette studio: React, Vite, Tailwind v4, shadcn/ui.
- `examples` — one Vite page per function, each showing when you'd reach for it.
- `tests` — the architectural test that keeps Tier 2 on Tier 1's public surface.
- `docs/concepts` — the architecture and the contract.

## License

MIT
