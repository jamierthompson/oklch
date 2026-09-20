import { formatHex } from "@jamiethompson/oklch";

import {
  color,
  field,
  form,
  json,
  live,
  out,
  page,
  swatches,
} from "../shared/ui.ts";

const main = page(
  "formatHex",
  "What does a hex-only consumer get?",
  "Hex is 8-bit sRGB: it cannot hold a P3 color, so out-of-sRGB input is refused by name — map first, then format what ships. Within sRGB the only loss is quantization, and the report says how much.",
);
const input = field(form(main), "color", {
  value: "oklch(0.62 0.2 30)",
  spellcheck: "false",
});

live(form(main), out(main), () => {
  const c = color(input);
  const report = formatHex(c);
  return (
    swatches([
      [c, "asked"],
      [report.color, report.hex],
    ]) + json(report)
  );
});
