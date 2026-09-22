# oklch

A theme studio for shadcn/ui, and the OKLCH library under it. Two
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

`apps/studio` opens on 32 preset themes drawn from NFL club colors, each
hand-tuned: its seeds and harmony were chosen by eye, one by one, because
one formula does not serve every color. The Raiders have no hue at all, so
there is nothing to harmonize; the Steelers lead with a yellow at L 0.82,
so the ink on it is dark and the dark scheme keeps the seed. Every
preset's recipe, and why it is not the formula's, is in
`src/lib/presets.ts`. A preset is a recipe over the formula, not a frozen
palette: the ramps are still drafted from the seeds, so the presets
improve with the math.

Themes live in one list in the sidebar, in the shape of Notion's. A
preset is a theme like any other: each has a menu to rename, duplicate,
or delete it, and undo brings back a deletion. A duplicate lands directly
below the theme it copies. The + adds a new one at the top, selected, with
a random two-word name, primary, secondary, and harmony. On the right, the rail holds the two seeds and the
harmony; on a phone it is a drawer with undo at hand. The step a seed sits
on is the seed: move either and the other follows. Everything on the page
is a pure function of the theme.

The ramps are the work. Every step has sliders, and moving one changes every
token that lands on it. The tokens are shadcn/ui's thirty-one variables, in
light and dark, each on the ramp its role plays: `primary` on the primary
ramp, `accent` on the first harmony, the chart series across the chromatic
ramps. Roles are set on the ramp that plays them. Surfaces are picked steps;
inks are solved on their surface, and a pick or a solve that does not clear
is shown failing, with the WCAG ratio and the APCA Lc it measured. Real
shadcn components render the palette as it stands, failures included.

There is no draft and nothing to save. Every change is applied and stored
at once, and every change is a command in one log with its inverse
attached. Undo steps back one, and nudges you the first few times so you
know it is there. The activity drawer shows the whole log as a feed, by
theme, and undoing an entry rewinds everything after it too, the way
Photoshop's History panel does. Those entries stay, greyed, until you redo
them or make a new change. A drag is one entry, not a hundred.

Once every pairing clears, the set ships as shadcn's `:root` / `.dark` /
`@theme inline` CSS, a `registry:theme` item for `npx shadcn add`, or DTCG
tokens. Nothing ships before that. There is no fallback color. At any time,
the theme also ships as a preset: the recipe over the formula, with only the
steps the eye moved, ready to paste into the presets file.

Not affiliated with or endorsed by the NFL or any team. Team names identify
whose colors a palette is derived from; the hexes are community-sourced
approximations, not official values.

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

const ramp = createRamp({ through: seed, gamut: "srgb" }); // a draft, not a palette
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
  `src/lib` holds the theme document and what ships from it.
- `tests` — the architectural test that keeps each tier on the one below.
- `docs/concepts` — the architecture and the contract.

## License

MIT
