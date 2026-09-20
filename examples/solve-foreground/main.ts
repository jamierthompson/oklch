import {
  CONTRAST_TARGETS,
  formatOklch,
  solveForeground,
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
  "solveForeground",
  "I've placed a surface — what's the nearest ink that clears on it?",
  "Never guesses a direction. Solves from white down and from black up, returns both, names the nearer, and throws when neither clears. A solver that picked by <code>L ≥ 0.5</code> returned failing black on light mid-tones with no signal; the real crossover depends on the target.",
);
const f = form(main);
const bg = field(f, "background", {
  value: "oklch(0.9 0.08 150)",
  spellcheck: "false",
});
const C = field(f, "ink C", {
  type: "number",
  step: "0.01",
  min: "0",
  value: "0.1",
});
const H = field(f, "ink H", { type: "number", step: "1", value: "150" });
const target = select(f, "target", Object.keys(CONTRAST_TARGETS));
const gamut = gamutField(f);

live(f, out(main), () => {
  const b = color(bg);
  const solved = solveForeground(
    b,
    CONTRAST_TARGETS[target.value as keyof typeof CONTRAST_TARGETS],
    {
      ink: { C: num(C), H: num(H) },
      gamut: gamut() as never,
    },
  );
  const pane = (name: "light" | "dark") => {
    const s = solved.toward[name];
    if (s === null)
      return `<pre>toward ${name}: nothing clears, not even the pole</pre>`;
    return `<div class="pair" style="color:${formatOklch(s.color)};background:${formatOklch(b)}">toward ${name}: L ${s.lightness.toFixed(5)}${solved.nearest === name ? " (nearest)" : ""}</div>`;
  };
  return pane("light") + pane("dark") + json(solved);
});
