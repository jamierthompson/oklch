import { buildTokenSet, tokenSetToDesignTokens } from "@jamiethompson/oklch";

import { readSpec, specText, tokenTable } from "../shared/spec.ts";
import { form, gamutField, live, out, page, steps } from "../shared/ui.ts";

const main = page(
  "tokenSetToDesignTokens",
  "What does this ship as, for a token pipeline?",
  "DTCG 2025.10: one <code>color</code> token per binding, <code>$value</code> in OkLCH at full precision holding what ships in the set's gamut, the format's own <code>hex</code> slot carrying the sRGB fallback. The fallback's exact components, the ramp step, and the receipt travel in <code>$extensions</code>.",
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
  return (
    tokenTable(set) +
    `<pre>${escape(JSON.stringify(tokenSetToDesignTokens(set), null, 2))}</pre>`
  );
});
