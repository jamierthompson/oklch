import { HARMONY_KINDS, harmony } from "@jamiethompson/oklch";

import {
  color,
  field,
  form,
  gamutField,
  json,
  live,
  out,
  page,
  select,
  swatches,
} from "../shared/ui.ts";

const main = page(
  "harmony",
  "Which hues are in harmony with this one?",
  "Colour-theory vocabulary — complementary, analogous, triadic, split-complementary — not presets. Takes a valid OkLCH: the caller parses, and there is no fallback seed. Each derived color is a gamut-map report.",
);
const f = form(main);
const seed = field(f, "seed", {
  value: "oklch(0.65 0.2 30)",
  spellcheck: "false",
});
const kind = select(f, "kind", Object.keys(HARMONY_KINDS));
const gamut = gamutField(f);

live(f, out(main), () => {
  const set = harmony(
    color(seed),
    kind.value as keyof typeof HARMONY_KINDS,
    gamut() as never,
  );
  return (
    swatches([
      [set.seed, "seed"],
      ...set.colors.map(
        (r, i) =>
          [r.color, `${set.offsets[i]}°${r.moved ? " (mapped)" : ""}`] as const,
      ),
    ] as never) + json(set)
  );
});
