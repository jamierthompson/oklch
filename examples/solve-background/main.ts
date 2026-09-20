import {
  CONTRAST_TARGETS,
  formatOklch,
  solveBackground,
} from "@jamiethompson/oklch";

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
  select,
} from "../shared/ui.ts";

const main = page(
  "solveBackground",
  "I've placed an ink — how far can the surface move before it stops clearing?",
  "Fixed-count bisection of the surface's lightness from the safe end toward the limit. One-side rule: a range that straddles the text's own lightness flips the pass test twice and is refused by name. The surface is mapped into the gamut that ships, and measured on its sRGB fallback — both reported.",
);
const f = form(main);
const text = field(f, "text", {
  value: "oklch(0.25 0.05 264)",
  spellcheck: "false",
});
const C = field(f, "surface C", {
  type: "number",
  step: "0.01",
  min: "0",
  value: "0.04",
});
const H = field(f, "surface H", { type: "number", step: "1", value: "264" });
const safe = field(f, "range.safe", {
  type: "number",
  step: "0.01",
  min: "0",
  max: "1",
  value: "1",
});
const limit = field(f, "range.limit", {
  type: "number",
  step: "0.01",
  min: "0",
  max: "1",
  value: "0",
});
const target = select(f, "target", Object.keys(CONTRAST_TARGETS));
const gamut = gamutField(f);

live(f, out(main), () => {
  const t = color(text);
  const solved = solveBackground(
    t,
    CONTRAST_TARGETS[target.value as keyof typeof CONTRAST_TARGETS],
    {
      surface: { C: num(C), H: num(H) },
      range: { safe: num(safe), limit: num(limit) },
      gamut: gamut() as never,
    },
  );
  const bg = solved.background;
  return (
    `
    <div class="pair" style="color:${formatOklch(t)};background:${formatOklch(bg.color)}">
      Surface at L ${bg.lightness.toFixed(5)} — the furthest that still clears
    </div>` + json(solved)
  );
});
