import {
  CONTRAST_TARGETS,
  checkContrast,
  formatOklch,
} from "@jamiethompson/oklch";

import {
  color,
  field,
  form,
  json,
  live,
  out,
  page,
  select,
} from "../shared/ui.ts";

const main = page(
  "checkContrast",
  "Does this pairing clear?",
  "Both standards against their own bar, each with its margin. A pairing passes only when both do — at the same floor the two disagree by about 2×, so a WCAG-only verdict lands on pairings that fail perceptually. No <code>SOLVE_MARGIN</code>: nothing rounds toward the bar.",
);
const f = form(main);
const text = field(f, "text", {
  value: "oklch(0.55 0 0)",
  spellcheck: "false",
});
const bg = field(f, "background", { value: "#ffffff", spellcheck: "false" });
const target = select(f, "target", Object.keys(CONTRAST_TARGETS));

live(f, out(main), () => {
  const t = color(text);
  const b = color(bg);
  const check = checkContrast(
    t,
    b,
    CONTRAST_TARGETS[target.value as keyof typeof CONTRAST_TARGETS],
  );
  return (
    `
    <div class="pair" style="color:${formatOklch(t)};background:${formatOklch(b)}">
      ${check.passes ? "Clears" : "Does not clear"} ${target.value}
    </div>` + json(check)
  );
});
