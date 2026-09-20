import {
  CONTRAST_TARGETS,
  buildTokenSet,
  resolveBinding,
} from "@jamiethompson/oklch";

import { readSpec, specText, tokenRow } from "../shared/spec.ts";
import {
  field,
  form,
  gamutField,
  json,
  live,
  num,
  out,
  page,
  select,
  steps,
} from "../shared/ui.ts";

const main = page(
  "resolveBinding",
  "Bind one token: pick a step by eye, or solve for the first that clears.",
  "With <code>step</code>, the token is that step, and with <code>on</code> + <code>target</code> the pick is verified — a pick that fails is refused with its numbers. Without <code>step</code>, the token is solved: the first step that clears on the surface named. There is no fallback color; where garden fell back, this throws.",
);
const f = form(main);
const spec = steps(f, "context", specText());
spec.rows = 14;
const token = field(f, "token", { value: "ink-strong", spellcheck: "false" });
const ramp = field(f, "ramp", { value: "blue", spellcheck: "false" });
const step = field(f, "step", {
  type: "number",
  min: "0",
  step: "1",
  value: "",
  placeholder: "blank = solve",
});
const on = field(f, "on", { value: "surface", spellcheck: "false" });
const target = select(f, "target", ["", ...Object.keys(CONTRAST_TARGETS)]);
target.value = "bodyText";
const gamut = gamutField(f);

live(f, out(main), () => {
  const g = gamut() as never;
  const { ramps, bindings } = readSpec(spec.value);
  const set = buildTokenSet({ ramps, bindings, gamut: g });
  const binding = {
    token: token.value,
    ramp: ramp.value,
    ...(step.value.trim() === "" ? {} : { step: num(step) }),
    ...(on.value.trim() === "" ? {} : { on: on.value }),
    ...(target.value === ""
      ? {}
      : {
          target:
            CONTRAST_TARGETS[target.value as keyof typeof CONTRAST_TARGETS],
        }),
  };
  const resolved = resolveBinding(binding, {
    ramps,
    tokens: set.tokens,
    gamut: g,
  });
  return (
    `<div class="wrap"><table><tr><th>token</th><th></th><th>from</th><th>moved</th><th>receipt</th></tr>${tokenRow(resolved, set)}</table></div>` +
    json(resolved)
  );
});
