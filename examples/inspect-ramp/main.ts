import { formatOklch, inspectRamp } from "@jamiethompson/oklch";

import {
  colors,
  fixed,
  form,
  gamutField,
  live,
  out,
  page,
  steps,
} from "../shared/ui.ts";

const main = page(
  "inspectRamp",
  "What does each step I placed measure, and how do the neighbours relate?",
  "Nothing is generated. The steps are the colors your eye chose — L, C <em>and</em> H per step. Per step: the map's move, chroma as a share of the safe prefix, on-cusp, both meters against white and black. Between steps, the one thing Tier 1 can't see: ΔEOK to each neighbour, whether lightness runs one way, and where the spacing bunches.",
);
const f = form(main);
const ramp = steps(
  f,
  "steps",
  [
    "oklch(0.97 0.012 254)",
    "oklch(0.88 0.04 255)",
    "oklch(0.71 0.13 258)",
    "oklch(0.55 0.19 262)",
    "oklch(0.42 0.16 265)",
    "oklch(0.28 0.09 268)",
  ].join("\n"),
);
const gamut = gamutField(f);

live(f, out(main), () => {
  const report = inspectRamp(colors(ramp), gamut() as never);
  const rows = report.steps.map(
    (s) => `<tr>
      <td>${s.index}</td>
      <td class="chip"><div style="background:${formatOklch(s.color)}"></div></td>
      <td>${fixed(s.color.L, 3)}</td>
      <td>${fixed(s.color.C, 3)} / ${fixed(s.maxChroma, 3)} (${fixed(s.chromaShare * 100, 0)}%)${s.onCusp ? " cusp" : ""}</td>
      <td>${s.map.moved ? fixed(s.map.deltaEOK, 3) : "—"}</td>
      <td>${s.fallback.moved ? fixed(s.fallback.deltaEOK, 3) : "—"}</td>
      <td>${fixed(s.contrast.onWhite.wcag, 2)} / ${fixed(s.contrast.onWhite.apca, 0)}</td>
      <td>${fixed(s.contrast.onBlack.wcag, 2)} / ${fixed(Math.abs(s.contrast.onBlack.apca), 0)}</td>
    </tr>`,
  );
  const gaps = report.gaps.map(
    (g, i) => `<tr>
      <td>${g.from} → ${g.to}</td>
      <td>${fixed(g.deltaEOK, 4)}</td>
      <td>${fixed(g.shareOfMean, 2)}×${i === report.spacing.tightest ? " tightest" : ""}${i === report.spacing.widest ? " widest" : ""}</td>
      <td>${g.deltaL >= 0 ? "+" : ""}${fixed(g.deltaL, 3)}</td>
    </tr>`,
  );
  return `
    <div class="strip" style="background:linear-gradient(to right, ${report.steps.map((s) => formatOklch(s.color)).join(",")})"></div>
    <div class="wrap"><table>
      <tr><th>#</th><th></th><th>L</th><th>C / max</th><th>map ΔE</th><th>sRGB ΔE</th><th>on white</th><th>on black</th></tr>
      ${rows.join("")}
    </table></div>
    <div class="wrap"><table>
      <tr><th>gap</th><th>ΔEOK</th><th>of mean</th><th>ΔL</th></tr>
      ${gaps.join("")}
    </table></div>
    <pre>lightness: ${report.lightness.direction}   mean gap: ${fixed(report.spacing.mean, 4)} ΔEOK   contrast columns: WCAG / APCA Lc</pre>`;
});
