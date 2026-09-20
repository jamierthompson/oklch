import { formatOklch } from "@jamiethompson/oklch";

import { color, field, form, live, out, page, swatches } from "../shared/ui.ts";

const main = page(
  "formatOklch",
  "What does the stylesheet get?",
  "The channel values digit for digit. colorjs.io gamut-maps and rounds to five digits by default; both are switched off at the call site, so an out-of-gamut color serializes unchanged and <code>0.1 + 0.2</code> prints as what it is. Throws on a non-finite channel — a browser drops invalid CSS silently.",
);
const input = field(form(main), "color", {
  value: "oklch(0.30000000000000004 0.35 30)",
  spellcheck: "false",
});

live(form(main), out(main), () => {
  const c = color(input);
  return (
    swatches([[c, "as the browser paints it"]]) + `<pre>${formatOklch(c)}</pre>`
  );
});
