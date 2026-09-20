import { CONTRAST_TARGETS, formatOklch, minPass } from "@jamiethompson/oklch";

import {
  color,
  colors,
  field,
  fixed,
  form,
  live,
  out,
  page,
  select,
  steps,
} from "../shared/ui.ts";

const main = page(
  "minPass",
  "Which is the first step that clears on this surface?",
  "Walks the ramp in order and returns the first step whose pairing clears the target under both standards, with every step's measurement alongside. Throws on an empty ramp rather than returning <code>undefined</code>, and by name when nothing clears.",
);
const f = form(main);
const ramp = steps(
  f,
  "ramp",
  [
    "oklch(0.97 0.012 254)",
    "oklch(0.88 0.04 255)",
    "oklch(0.71 0.13 258)",
    "oklch(0.55 0.19 262)",
    "oklch(0.42 0.16 265)",
    "oklch(0.28 0.09 268)",
  ].join("\n"),
);
const bg = field(f, "background", { value: "#ffffff", spellcheck: "false" });
const target = select(f, "target", Object.keys(CONTRAST_TARGETS));

live(f, out(main), () => {
  const b = color(bg);
  const list = colors(ramp);
  const result = minPass(
    list,
    b,
    CONTRAST_TARGETS[target.value as keyof typeof CONTRAST_TARGETS],
  );
  const rows = result.checks.map(
    (c, i) => `<tr>
      <td>${i}${i === result.index ? " ◀" : ""}</td>
      <td class="chip"><div style="background:${formatOklch(list[i]!)}"></div></td>
      <td>${fixed(c.wcag.value, 2)} (${c.wcag.margin >= 0 ? "+" : ""}${fixed(c.wcag.margin, 2)})</td>
      <td>${fixed(c.apca.value, 1)} (${c.apca.margin >= 0 ? "+" : ""}${fixed(c.apca.margin, 1)})</td>
      <td>${c.passes ? "clears" : ""}</td>
    </tr>`,
  );
  return `
    <div class="pair" style="color:${formatOklch(result.color)};background:${formatOklch(b)}">Step ${result.index} is the first that clears ${target.value}</div>
    <div class="wrap"><table>
      <tr><th>#</th><th></th><th>WCAG (margin)</th><th>APCA (margin)</th><th></th></tr>
      ${rows.join("")}
    </table></div>`;
});
