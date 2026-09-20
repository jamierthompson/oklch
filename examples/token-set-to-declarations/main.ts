import { buildTokenSet, tokenSetToDeclarations } from "@jamiethompson/oklch";

import { readSpec, specText, tokenTable } from "../shared/spec.ts";
import { form, gamutField, live, out, page, steps } from "../shared/ui.ts";

const main = page(
  "tokenSetToDeclarations",
  "What does this ship as, in plain CSS?",
  "One custom property per token on <code>:root</code>, holding the sRGB fallback at full precision. When the set was built for P3, every token whose P3 color differs is redeclared under <code>@media (color-gamut: p3)</code> — browsers clip, they don't map, so the fallback is the base. A set built for sRGB emits no media block.",
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
  return tokenTable(set) + `<pre>${escape(tokenSetToDeclarations(set))}</pre>`;
});
