import { buildTokenSet, tokenSetToTailwindTheme } from "@jamiethompson/oklch";

import { readSpec, specText, tokenTable } from "../shared/spec.ts";
import { form, gamutField, live, out, page, steps } from "../shared/ui.ts";

const main = page(
  "tokenSetToTailwindTheme",
  "What does this ship as, for Tailwind v4?",
  "<code>--color-&lt;token&gt;</code> in <code>@theme</code>, so <code>bg-&lt;token&gt;</code> and <code>text-&lt;token&gt;</code> exist. Each is a <code>light-dark()</code>. <code>color-scheme</code> cannot live in <code>@theme</code>, so it is declared on <code>:root</code> alongside, where Tailwind emits theme variables and where the P3 override redeclares them.",
);
const f = form(main);
const spec = steps(f, "spec", specText());
spec.rows = 20;
const gamut = gamutField(f);

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

live(f, out(main), () => {
  const set = buildTokenSet({
    ...readSpec(spec.value),
    gamut: gamut() as never,
  });
  return tokenTable(set) + `<pre>${escape(tokenSetToTailwindTheme(set))}</pre>`;
});
