# Project conventions

## Layout

pnpm workspace. Two packages and a guard:

| Path                         | What it is                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `apps/studio`                | OKLCH Studio, a Vite + React SPA. `src/lib` holds the theme document and exports.  |
| `packages/oklch`             | `@jamiethompson/oklch`, the published color library. Depends on colorjs.io only.   |
| `tests/architecture.test.ts` | Reads the library's sources and fails if a tier imports past the tier below it.    |
| `docs/concepts`              | The library's architecture and contract. Read it before touching `packages/oklch`. |

## Stack

Vite 8 · React 19 · TypeScript 6 · Tailwind CSS v4 (`@tailwindcss/vite`) ·
shadcn/ui on Base UI · ESLint (flat config) · Prettier · Vitest + Testing
Library · Playwright · pnpm

Use `pnpm` for everything (`pnpm add`, `pnpm dlx shadcn@latest ...`). Never run
`npm install` or `npx` in this repo. Node 22 or newer (`engines`).

## Monorepo: shadcn lives in `apps/studio`

`components.json` is in `apps/studio`, not at the root. Run every shadcn CLI
command against that workspace, or the CLI stops with a monorepo notice:

```bash
pnpm dlx shadcn@latest info -c apps/studio
pnpm dlx shadcn@latest docs button -c apps/studio
pnpm dlx shadcn@latest add badge -c apps/studio --dry-run
```

`pnpm --filter studio exec shadcn <command>` is equivalent and uses the
version pinned in the studio's `package.json`.

The shadcn MCP server in `.mcp.json` is already started with `-c apps/studio`.
The `shadcn` skill injects `shadcn info` output when it loads; at the root that
is the monorepo notice, not the config, so run the `info` command above when
you need aliases, resolved paths, or the installed component list.

## Tailwind CSS v4

- There is NO `tailwind.config.js`. Do not create one. Configuration lives in
  `apps/studio/src/index.css` via `@theme inline`.
- The stylesheet starts with `@import "tailwindcss"`, then
  `@import "shadcn/tailwind.css"`. No `@tailwind base/...`.
- There is no `content` array. To safelist a class use `@source inline("...")`.
- Color values MUST be wrapped in `oklch()`. Bare triplets are v3 syntax and
  silently fail.
- Adding a color token: define `--name` and `--name-foreground` under BOTH
  `:root` and `.dark`, then map them in `@theme inline` as
  `--color-name: var(--name)`.
- Dark mode is class-based (`@custom-variant dark`). `.dark` on `<html>`
  follows the OS through `useSystemScheme` in `App.tsx`; there is no user
  toggle. `Preview.tsx` scopes `.dark` on a wrapper and sets the token
  variables inline, which is how one page shows both schemes side by side.
- One typeface: Geist Variable via `@fontsource-variable/geist`, exposed as
  `--font-sans`; `--font-heading` aliases it.
- The token variables in `index.css` are the studio's own chrome, the stock
  neutral shadcn theme. The themes the studio edits live in `src/lib/theme.ts`
  and reach the DOM only as inline variables on previews. Do not wire an edited
  theme into `index.css`.

## shadcn/ui

- Components are OURS, in `apps/studio/src/components/ui/`. Edit them
  directly. `shadcn` is a dependency for the CLI and `shadcn/tailwind.css`
  only.
- This project uses **Base UI**, not Radix. The composition prop is `render`,
  NOT `asChild`.
- Before writing or using a component, run
  `pnpm dlx shadcn@latest docs <name> -c apps/studio` or use the shadcn MCP
  tools. Do not recall APIs from memory.
- Check whether a component exists before hand-rolling one:
  `pnpm dlx shadcn@latest search @shadcn -q "<thing>" -c apps/studio`.
- Add components with `pnpm dlx shadcn@latest add <name> -c apps/studio`.
- `cn` comes from the `cn` package. Import it from `"cn"` as the existing code
  does; `@/lib/utils` re-exports it for the shadcn alias.
- Use semantic tokens (`bg-primary`, `text-muted-foreground`), never literal
  palette utilities like `bg-zinc-950 dark:bg-white`. Pair every color with
  its `-foreground` partner.
- This is a Vite SPA: `rsc` is false, so no `"use client"` directives.
- `src/components/Field.tsx` is the studio's own slider row (label, slider,
  value), not shadcn's form `Field`. If the shadcn `field` component is added,
  resolve the name clash rather than shadowing one with the other.
- Destructive confirmations use `AlertDialog`, not `Dialog`. Option sets use
  `ToggleGroup`.

## The library (`packages/oklch`)

- `docs/concepts/architecture.md` is the contract. Every function is a thin
  wrapper over colorjs.io that refuses by name, reports what moved, and never
  clamps, rounds, or falls back. Keep it that way.
- Three tiers, enforced by `tests/architecture.test.ts`: Tier 2 imports only
  Tier 1's public surface, Tier 3 only Tier 2's. A new Tier 1 module must be
  exported from `tier1.ts`.
- Pure and isomorphic. ESLint forbids `window`, `document`, `process`, and
  friends under `packages/oklch/src`.

## Testing

- Vitest runs two projects from the root config: `oklch` (the library and
  `tests/`) and `studio` (jsdom, Testing Library, `globals: true`, a
  `matchMedia` mock in `src/test/setup.ts`).
- Tests sit beside their source as `*.test.ts` / `*.test.tsx`.
- Playwright covers the primary flow in `apps/studio/e2e`. Run it with
  `pnpm --filter studio e2e`.

## Before you finish

Run `pnpm gate`. It is the same chain CI runs: format check, lint, typecheck,
test, build. E2E is a separate CI job.
