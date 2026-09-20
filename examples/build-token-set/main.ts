import { buildTokenSet } from "@jamiethompson/oklch";

import { readSpec, specText, tokenTable } from "../shared/spec.ts";
import { form, gamutField, live, out, page, steps } from "../shared/ui.ts";

const main = page(
  "buildTokenSet",
  "Bind these ramps to these semantic roles, with a receipt per pairing.",
  "Nothing more than <code>resolveBinding</code> in order, so anything it builds can be rebuilt one binding at a time. A surface must be bound before the inks that sit on it. Every pairing gets a receipt that names the standard it answers to; a pairing that does not clear is refused, not filled in.",
);
const f = form(main);
const spec = steps(f, "spec", specText());
spec.rows = 22;
const gamut = gamutField(f);

live(f, out(main), () => {
  const set = buildTokenSet({
    ...readSpec(spec.value),
    gamut: gamut() as never,
  });
  return (
    tokenTable(set) +
    `<pre>${set.receipts.length} receipts · ${set.tokens.length} tokens · gamut ${set.gamut}</pre>`
  );
});
