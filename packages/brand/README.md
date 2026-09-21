# @jamiethompson/oklch-brand

A brand document over [`@jamiethompson/oklch`](https://www.npmjs.com/package/@jamiethompson/oklch):
the ramps the eye drew, which ramp plays which shadcn/ui role, and the steps
moved off the preset. Pure functions from the document to bindings, a verdict
per token, and the files that ship; and a CLI.

```bash
pnpm add -D @jamiethompson/oklch-brand
pnpm oklch-brand check acme.oklch.json          # a verdict per token; exit 1 unless all clear
pnpm oklch-brand build acme.oklch.json -o src   # acme.css, acme.registry.json, acme.tokens.json
```

`build` writes shadcn's `:root` / `.dark` / `@theme inline` CSS, a
`registry:theme` item for `npx shadcn add`, and DTCG design tokens. Nothing is
written unless every token clears. There is no fallback color.

The studio that edits these files lives in the
[oklch repository](https://github.com/jamierthompson/oklch).

MIT.
