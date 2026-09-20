import { contrastAPCA, contrastWCAG, formatOklch } from "@jamiethompson/oklch";

import { color, field, fixed, form, live, out, page } from "../shared/ui.ts";

const main = page(
  "contrastWCAG / contrastAPCA",
  "What does this pairing measure?",
  "Two meters that disagree on purpose: WCAG 2.x is the symmetric conformance ratio, APCA the signed perceptual estimate. Both are defined over sRGB, so out-of-sRGB input is refused by name — measuring it through a clamp once turned a failing Lc 72.8 into a passing 75.3. Map first, then measure what ships.",
);
const f = form(main);
const text = field(f, "text", {
  value: "oklch(0.45 0.2 264)",
  spellcheck: "false",
});
const bg = field(f, "background", { value: "#ffffff", spellcheck: "false" });

live(f, out(main), () => {
  const t = color(text);
  const b = color(bg);
  return `
    <div class="pair" style="color:${formatOklch(t)};background:${formatOklch(b)}">The quick brown fox</div>
    <pre>contrastWCAG(text, background) = ${fixed(contrastWCAG(t, b), 3)}  (1..21, symmetric)
contrastAPCA(text, background) = ${fixed(contrastAPCA(t, b), 2)}  (Lc, signed by polarity)</pre>`;
});
