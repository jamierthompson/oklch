# oklch

A brand palette studio for shadcn/ui, and the OKLCH library under it. Two
seeds in, a theme out, with every step still yours to move and a verdict
beside it.

## Why this exists

The engine before this one took a seed and never threw: a fully solved
theme every time, even from garbage, with a receipt for every token. It
worked, and it was the wrong promise. A palette is not finished when it
measures right. It is finished when someone looks at it and says so, and no
solver can do that part.

Tailwind is the proof. Its palette is built in OKLCH, and it still does not
step lightness the same way for every hue. The 500 step sits at L 0.795 for
yellow and L 0.585 for indigo, because "looks like a yellow" beat "measures
the same." Someone with eyes chose that. A formula drafts; an eye signs off.

So this tool draws the draft, makes the eye fast, and never signs off.

## The studio

`apps/studio` opens empty. Try a color and it drafts a whole palette in
memory: a neutral tinted to the color's hue, the primary ramp through the
color so the color is a step exactly, a red, and one ramp per harmony of the
hue. A second seed adds a secondary ramp. The rail on the right holds the two
seeds and the harmony; everything on the page is a pure function of them.

The ramps are the work. Every step has sliders, and moving one changes every
token that lands on it. The tokens are shadcn/ui's thirty-one variables, in
light and dark, each on the ramp its role plays: `primary` on the primary
ramp, `accent` on the first harmony, the chart series across the chromatic
ramps. Roles are set on the ramp that plays them. Surfaces are picked steps;
inks are solved on their surface, and a pick or a solve that does not clear
is shown failing, with the WCAG ratio and the APCA Lc it measured. Real
shadcn components render the palette as it stands, failures included.

Once every pairing clears, the set ships as shadcn's `:root` / `.dark` /
`@theme inline` CSS, a `registry:theme` item for `npx shadcn add`, or DTCG
tokens. Nothing ships before that. There is no fallback color.

Saved brands persist in the browser. A draft lives only in the page until
it is saved.

## The library

`packages/oklch` is a thin contract over [colorjs.io](https://colorjs.io):
colorjs.io does the math, the package decides what the math is allowed to
say. Every function refuses by name, reports what moved, and never clamps,
rounds, or falls back. P3 is first-class, sRGB is the fallback, and every
gamut-aware function takes the gamut because a default would be a silent
decision.

```bash
pnpm add @jamiethompson/oklch
```

Three tiers, each built from the one below through its public surface only,
and an architectural test that fails if one reaches past that.

| Tier | What it answers                                                         |
| ---- | ----------------------------------------------------------------------- |
| 1    | One color or one pair: parse, gamut, distance, contrast, solve, hue.    |
| 2    | A list of steps: draft a ramp, inspect one, find the first that clears. |
| 3    | A whole system: bind steps to roles with a receipt per pairing, ship.   |

```ts
import { createRamp, minPass, CONTRAST_TARGETS } from "@jamiethompson/oklch";

const ramp = createRamp({ through: brand, gamut: "srgb" }); // a draft, not a palette
const ink = minPass(ramp.steps, surface, CONTRAST_TARGETS.bodyText); // the first step that clears, with its readings
```

See [docs/concepts/architecture.md](docs/concepts/architecture.md) for the
contract and the posture behind it.

## Develop

```bash
pnpm install
pnpm dev     # the studio
pnpm test    # the library's contract tests, and the studio's
pnpm gate    # format, lint, typecheck, test, build — what CI runs
```

## Structure

- `packages/oklch` — the library. Its only dependency is colorjs.io.
- `apps/studio` — the studio: React, Vite, Tailwind v4, shadcn/ui. Its
  `src/lib` holds the brand document and what ships from it.
- `tests` — the architectural test that keeps each tier on the one below.
- `docs/concepts` — the architecture and the contract.

## License

MIT
