import { createScale, deltaEOK, formatOklch } from "@jamiethompson/oklch";

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
  "createScale",
  "Equal steps in data → equal perceived steps?",
  "A continuous sequential scale for data — a heatmap, an activation — not a palette. One hue, lightness carrying the magnitude, chroma a fraction of the safe prefix. The curve is sampled, ΔEOK accumulated, and the table inverted, so <code>at(t)</code> is parameterized by distance travelled. Saturation is a fraction: 4 is refused, not clamped.",
);
const f = form(main);
const hue = field(f, "hue", {
  type: "range",
  min: "0",
  max: "360",
  step: "1",
  value: "250",
});
const surface = field(f, "surface L", {
  type: "number",
  step: "0.01",
  min: "0",
  max: "1",
  value: "0.98",
});
const end = field(f, "end L", {
  type: "number",
  step: "0.01",
  min: "0",
  max: "1",
  value: "0.35",
});
const saturation = field(f, "saturation", {
  type: "number",
  step: "0.05",
  value: "0.8",
});
const gamut = gamutField(f);

live(f, out(main), () => {
  const scale = createScale({
    hue: num(hue),
    surfaceLightness: num(surface),
    endLightness: num(end),
    saturation: num(saturation),
    gamut: gamut() as never,
  });
  const stops = Array.from({ length: 11 }, (_, i) => scale.at(i / 10));
  const rows = stops.map(
    (c, i) => `<tr>
      <td>${fixed(i / 10, 1)}</td>
      <td class="chip"><div style="background:${formatOklch(c)}"></div></td>
      <td>${fixed(c.L, 3)}</td><td>${fixed(c.C, 3)}</td>
      <td>${i === 0 ? "—" : fixed(deltaEOK(stops[i - 1]!, c), 4)}</td>
    </tr>`,
  );
  const fine = Array.from({ length: 41 }, (_, i) =>
    formatOklch(scale.at(i / 40)),
  );
  return `
    <div class="strip" style="background:linear-gradient(to right, ${fine.join(",")})"></div>
    <div class="wrap"><table>
      <tr><th>t</th><th></th><th>L</th><th>C</th><th>ΔEOK from previous</th></tr>
      ${rows.join("")}
    </table></div>
    <pre>travel: ${fixed(scale.travel, 4)} ΔEOK — every tenth is ${fixed(scale.travel / 10, 4)} by construction</pre>`;
});
