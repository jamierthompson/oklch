# OKLCH Studio

A theme studio for [shadcn/ui](https://ui.shadcn.com), and the OKLCH color
library under it. Pick two seed colors and a harmony, tune the ramps by
eye, and ship the theme once every pairing clears contrast.

## Features

- **32 presets** drawn from NFL club colors, each hand-tuned. Rename,
  duplicate, or delete any of them, or add a new theme with the +.
- **Ramps, not fixed palettes.** Every step has sliders; moving one moves
  every token that lands on it.
- **All 31 shadcn/ui tokens**, light and dark, each bound to the ramp its
  role plays. Real shadcn components preview the result as it stands.
- **A verdict on every pairing.** Surfaces are picked steps, inks are solved
  on them, and anything that fails shows its WCAG ratio and APCA Lc.
- **Undo everything.** Each change is one entry in a log. Undo steps back,
  and the activity drawer rewinds to any point, Photoshop-History style.
- **Exports:** shadcn CSS (`:root` / `.dark` / `@theme inline`), a
  `registry:theme` item for `npx shadcn add`, DTCG tokens, or the theme as
  a preset. Nothing ships until every pairing clears.

Not affiliated with or endorsed by the NFL or any team. Team names identify
whose colors a palette is derived from; the hexes are community-sourced
approximations, not official values.

## Stack

React 19, Vite, Tailwind v4, shadcn/ui, and
[colorjs.io](https://colorjs.io) for the color math. pnpm workspace,
Vitest, Testing Library, Playwright.

## Getting started

```bash
pnpm install
pnpm dev      # the studio, at http://localhost:5173
```

```bash
pnpm test     # unit and component tests
pnpm gate     # format, lint, typecheck, test, build (what CI runs)
pnpm --filter studio e2e   # Playwright
```

## Structure

| Path             | What it is                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| `apps/studio`    | The studio. `src/lib` holds the theme document and its exports.        |
| `packages/oklch` | `@jamiethompson/oklch`: the color library. Depends on colorjs.io only. |
| `tests`          | An architectural test that keeps each library tier on the one below.   |
| `docs/concepts`  | The library's architecture and contract.                               |

## The library

`@jamiethompson/oklch` is a thin contract over colorjs.io: every function
refuses by name, reports what moved, and never clamps, rounds, or falls
back. P3 is first-class and every gamut-aware function takes the gamut
explicitly. Three tiers: one color, a ramp of steps, a whole token system.

```ts
import { createRamp, minPass, CONTRAST_TARGETS } from "@jamiethompson/oklch";

const ramp = createRamp({ through: seed, gamut: "srgb" });
const ink = minPass(ramp.steps, surface, CONTRAST_TARGETS.bodyText);
```

See [docs/concepts/architecture.md](docs/concepts/architecture.md).

## Agent tooling

- `AGENTS.md` holds project conventions for coding agents; `CLAUDE.md`
  includes it.
- `.mcp.json` registers the shadcn MCP server (search, view, and add registry
  items), pointed at `apps/studio`, where `components.json` lives.
- `.claude/skills/` holds the official shadcn skills (`shadcn`,
  `migrate-radix-to-base`), installed with `pnpm dlx skills add shadcn/ui` and
  tracked in `skills-lock.json`. Do not edit them by hand.
- `.claude/launch.json` tells Claude Code how to start the studio for previews.

## License

MIT
