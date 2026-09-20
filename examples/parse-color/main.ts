import { formatOklch, parseColor } from "@jamiethompson/oklch";

import { field, form, json, live, out, page, swatches } from "../shared/ui.ts";

const main = page(
  "parseColor",
  "What did I type?",
  "Any CSS color string, normalized to OkLCH. Returns <code>null</code> for anything else — a parser's domain is untrusted strings, so bad input is expected. Also null: translucent colors, negative chroma. Hue wraps; nothing is gamut-mapped.",
);
const input = field(form(main), "input", {
  value: "oklch(0.7 0.35 -30)",
  spellcheck: "false",
});

live(form(main), out(main), () => {
  const parsed = parseColor(input.value);
  if (parsed === null) return `<pre>null</pre>`;
  return swatches([[parsed, formatOklch(parsed)]]) + json(parsed);
});
