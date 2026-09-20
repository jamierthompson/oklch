import { formatOklch, gamutMap } from "@jamiethompson/oklch";

import {
  color,
  field,
  form,
  gamutField,
  json,
  live,
  out,
  page,
  swatches,
} from "../shared/ui.ts";

const main = page(
  "gamutMap",
  "Where does it land if not?",
  'CSS Color 4 gamut mapping: chroma reduced at constant lightness and hue to within one JND (0.02 ΔEOK) of the boundary, then clipped. Browsers don\'t map, they clip — so <code>gamutMap(c, "srgb")</code> is what a non-P3 screen should have been handed. Every result is a report of what moved.',
);
const f = form(main);
const input = field(f, "color", {
  value: "oklch(0.6 0.35 30)",
  spellcheck: "false",
});
const gamut = gamutField(f);

live(f, out(main), () => {
  const report = gamutMap(color(input), gamut() as never);
  return (
    swatches([
      [report.requested, "requested"],
      [report.color, `ships in ${gamut()}`],
    ]) +
    `<pre>${formatOklch(report.color)}</pre>` +
    json(report)
  );
});
