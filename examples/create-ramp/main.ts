import {
  TAILWIND_STOPS,
  createRamp,
  formatOklch,
  inspectRamp,
  parseColor,
} from "@jamiethompson/oklch";

import {
  field,
  fixed,
  form,
  gamutField,
  live,
  num,
  out,
  page,
  select,
} from "../shared/ui.ts";

const main = page(
  "createRamp",
  "A ramp to start from.",
  "A draft, not a palette. One hue through Tailwind's eleven stops, chroma a fixed share of what the gamut allows at each step — vivid at the cusp, quiet at the ends, in gamut by construction. Or draw it <em>through</em> a brand color: its hue and its share become the ramp's, and the nearest stop is moved onto it exactly. Then <code>inspectRamp</code> measures it and the eye moves what it disagrees with.",
);
const f = form(main);
const mode = select(f, "draw from", ["hue", "through a color"]);
const hue = field(f, "hue", {
  type: "range",
  min: "0",
  max: "360",
  step: "1",
  value: "260",
});
const saturation = field(f, "saturation", {
  type: "number",
  step: "0.05",
  min: "0",
  max: "1",
  value: "0.8",
});
const through = field(f, "through", {
  type: "text",
  value: "oklch(0.55 0.18 30)",
  spellcheck: "false",
});
const shift = field(f, "hue shift", {
  type: "number",
  step: "1",
  value: "0",
});
const stops = select(f, "stops", ["chromatic", "neutral"]);
const gamut = gamutField(f);

live(f, out(main), () => {
  const g = gamut() as never;
  const lightness = TAILWIND_STOPS[stops.value as "chromatic" | "neutral"];
  const common = { hueShift: num(shift), lightness, gamut: g };
  let ramp;
  if (mode.value === "hue") {
    ramp = createRamp({
      ...common,
      hue: num(hue),
      saturation: num(saturation),
    });
  } else {
    const c = parseColor(through.value);
    if (c === null)
      throw new Error(`parseColor("${through.value}") is null: not a color`);
    ramp = createRamp({ ...common, through: c });
  }
  const report = inspectRamp(ramp.steps, g);
  const rows = report.steps.map(
    (
      s,
      i,
    ) => `<tr${ramp.through?.index === i ? ' style="font-weight:600"' : ""}>
      <td>${TAILWIND_STOPS.names[i] ?? i}</td>
      <td class="chip"><div style="background:${formatOklch(s.color)}"></div></td>
      <td>${fixed(s.color.L, 3)}</td><td>${fixed(s.color.C, 3)}</td><td>${fixed(s.color.H, 1)}</td>
      <td>${fixed(s.chromaShare, 2)}</td>
      <td>${fixed(s.contrast.onWhite.wcag, 2)}</td><td>${fixed(s.contrast.onBlack.wcag, 2)}</td>
    </tr>`,
  );
  return `
    <div class="strip" style="background:linear-gradient(to right, ${ramp.steps.map(formatOklch).join(",")})"></div>
    <div class="wrap"><table>
      <tr><th>stop</th><th></th><th>L</th><th>C</th><th>H</th><th>share</th><th>WCAG on white</th><th>on black</th></tr>
      ${rows.join("")}
    </table></div>
    <pre>hue ${fixed(ramp.hue, 1)} · saturation ${fixed(ramp.saturation, 3)} · ${
      ramp.through === null
        ? "drawn from the hue"
        : `through step ${ramp.through.index} (${TAILWIND_STOPS.names[ramp.through.index]}), placed exactly`
    }
mean gap ${fixed(report.spacing.mean, 4)} ΔEOK · tightest between ${report.spacing.tightest} and ${(report.spacing.tightest ?? 0) + 1}</pre>`;
});
