import { deltaEOK } from "@jamiethompson/oklch";

import {
  color,
  field,
  fixed,
  form,
  live,
  out,
  page,
  swatches,
} from "../shared/ui.ts";

const main = page(
  "deltaEOK",
  "How far is this step from its neighbour?",
  "Euclidean distance in OKLab, which is what OKLab was fit so that distance would mean. One just-noticeable difference is 0.02. Throws on a non-finite channel rather than reporting NaN as a distance.",
);
const f = form(main);
const a = field(f, "a", { value: "oklch(0.7 0.12 250)", spellcheck: "false" });
const b = field(f, "b", { value: "oklch(0.72 0.12 250)", spellcheck: "false" });

live(f, out(main), () => {
  const d = deltaEOK(color(a), color(b));
  return (
    swatches([
      [color(a), "a"],
      [color(b), "b"],
    ]) +
    `<pre>deltaEOK(a, b) = ${fixed(d, 5)}  (${fixed(d / 0.02, 2)} JND)</pre>`
  );
});
