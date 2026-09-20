import { rotateHue } from "@jamiethompson/oklch";

import {
  color,
  field,
  form,
  gamutField,
  json,
  live,
  num,
  out,
  page,
  swatches,
} from "../shared/ui.ts";

const main = page(
  "rotateHue",
  "What's this color at another hue?",
  "Sets the hue, holds lightness and chroma, then gamut-maps — the same chroma is not available at every hue, so the map's move is part of the answer. Angles wrap: −30 is 330.",
);
const f = form(main);
const input = field(f, "color", {
  value: "oklch(0.85 0.17 95)",
  spellcheck: "false",
});
const degrees = field(f, "degrees", {
  type: "range",
  min: "-180",
  max: "180",
  step: "1",
  value: "180",
});
const gamut = gamutField(f);

live(f, out(main), () => {
  const report = rotateHue(color(input), num(degrees), gamut() as never);
  return (
    swatches([
      [color(input), "seed"],
      [report.requested, `asked: H ${report.requested.H.toFixed(1)}`],
      [report.color, report.moved ? "mapped" : "unmoved"],
    ]) + json(report)
  );
});
