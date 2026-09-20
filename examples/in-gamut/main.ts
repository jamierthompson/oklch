import { GAMUT_EPSILON, formatOklch, inGamut } from "@jamiethompson/oklch";

import { color, field, form, live, out, page, swatches } from "../shared/ui.ts";

const main = page(
  "inGamut",
  "Is this displayable on this screen?",
  `colorjs.io's check with the tolerance stated: a channel may sit ${GAMUT_EPSILON} outside [0, 1] and still count. Throws on a non-finite channel or negative chroma rather than answering false. Both gamuts are asked here because the answer differs by screen.`,
);
const input = field(form(main), "color", {
  value: "oklch(0.62 0.26 30)",
  spellcheck: "false",
});

live(form(main), out(main), () => {
  const c = color(input);
  return (
    swatches([[c, formatOklch(c)]]) +
    `<pre>inGamut(color, "p3")   = ${inGamut(c, "p3")}
inGamut(color, "srgb") = ${inGamut(c, "srgb")}</pre>`
  );
});
