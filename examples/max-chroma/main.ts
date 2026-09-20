import { formatOklch, maxChroma } from "@jamiethompson/oklch";

import {
  field,
  fixed,
  form,
  gamutField,
  live,
  num,
  out,
  page,
} from "../shared/ui.ts";

const main = page(
  "maxChroma",
  "How vivid can this step be?",
  "The safe prefix: the largest chroma at this lightness and hue below which <em>every</em> chroma is displayable. Not always the largest displayable chroma — near sRGB blue the gamut re-enters, and the far side of that notch is not a prefix. Fixed-count search; terminates by construction.",
);
const f = form(main);
const L = field(f, "L", {
  type: "range",
  min: "0",
  max: "1",
  step: "0.005",
  value: "0.6",
});
const H = field(f, "H", {
  type: "range",
  min: "0",
  max: "360",
  step: "1",
  value: "264",
});
const gamut = gamutField(f);

live(f, out(main), () => {
  const C = maxChroma(num(L), num(H), gamut() as never);
  const stops = Array.from({ length: 11 }, (_, i) =>
    formatOklch({ L: num(L), C: (C * i) / 10, H: num(H) }),
  );
  return `
    <div class="strip" style="background:linear-gradient(to right, ${stops.join(",")})"></div>
    <pre>maxChroma(${num(L)}, ${num(H)}, "${gamut()}") = ${fixed(C, 5)}
every point on the strip is inside ${gamut()}</pre>`;
});
