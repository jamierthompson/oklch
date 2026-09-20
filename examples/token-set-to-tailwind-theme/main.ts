import { buildTokenSet, tokenSetToTailwindTheme } from "@jamiethompson/oklch";

import { readSpec, specText, tokenTable } from "../shared/spec.ts";
import { form, gamutField, live, out, page, steps } from "../shared/ui.ts";

const main = page(
  "tokenSetToTailwindTheme",
  "What does this ship as, for Tailwind v4?",
  "<code>--color-&lt;token&gt;</code> in <code>@theme</code>, so <code>bg-&lt;token&gt;</code> and <code>text-&lt;token&gt;</code> exist. Tailwind emits theme variables on <code>:root</code>, which is where the P3 override redeclares them under the media query.",
);
const f = form(main);
const spec = steps(f, "spec", specText());
spec.rows = 14;
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
