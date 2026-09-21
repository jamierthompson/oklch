import {
  auditTokenSet,
  createRamp,
  formatOklch,
  parseColor,
  shadcnBindings,
  TAILWIND_STOPS,
  tokenSetToRegistryItem,
  tokenSetToShadcnCss,
  type AuditOutcome,
  type Ramp,
  type TokenAudit,
} from "@jamiethompson/oklch";

import { field, form, gamutField, live, num, out, page } from "../shared/ui.ts";

const main = page(
  "shadcn",
  "A brand color in, shadcn's theme out — with a verdict per token.",
  "The whole chain: <code>createRamp</code> draws a neutral tinted to the brand hue, the brand ramp through the color itself, and a red; <code>shadcnBindings</code> binds all 31 variables; <code>auditTokenSet</code> gives every token a verdict; and when every one clears, <code>tokenSetToShadcnCss</code> and <code>tokenSetToRegistryItem</code> ship it. A token that fails is shown failing, not filled in.",
);
const f = form(main);
const brand = field(f, "brand color", {
  type: "text",
  value: "#2563eb",
  spellcheck: "false",
});
const tint = field(f, "neutral tint (share of chroma)", {
  type: "number",
  step: "0.01",
  min: "0",
  max: "1",
  value: "0.05",
});
const gamut = gamutField(f);

function chip(
  outcome: AuditOutcome,
  surfaceOf: (on: string) => string | null,
): string {
  if (outcome.kind === "unresolved") return `<td class="chip"><div></div></td>`;
  const color = formatOklch(outcome.resolved.color);
  const on =
    outcome.kind === "fails"
      ? surfaceOf(outcome.on)
      : outcome.resolved.receipt === null
        ? null
        : surfaceOf(outcome.resolved.receipt.on);
  return on === null
    ? `<td class="chip"><div style="background:${color}"></div></td>`
    : `<td class="chip"><div style="background:${on};color:${color};width:auto;padding:0 8px;font-weight:600">Aa</div></td>`;
}

function verdict(a: TokenAudit): string {
  const o = a.outcome;
  if (o.kind === "unresolved")
    return `<span class="refusal">${o.reason}</span>`;
  const r = o.resolved;
  const where = `${r.ramp}[${r.step}] ${r.how}`;
  if (o.kind === "fails")
    return `${where} · <span class="refusal">fails on ${o.on}: WCAG ${o.check.wcag.value.toFixed(2)} / ${o.target.wcag}, APCA ${o.check.apca.value.toFixed(1)} / ${o.target.apca}</span>`;
  if (r.receipt === null) return `${where}`;
  return `${where} · on ${r.receipt.on}: WCAG ${r.receipt.wcag.value.toFixed(2)} ≥ ${r.receipt.target.wcag}, APCA ${r.receipt.apca.value.toFixed(1)} ≥ ${r.receipt.target.apca}`;
}

live(f, out(main), () => {
  const g = gamut() as never;
  const seed = parseColor(brand.value);
  if (seed === null)
    throw new Error(`parseColor("${brand.value}") is null: not a color`);
  const ramps: Ramp[] = [
    {
      name: "neutral",
      steps: createRamp({
        hue: seed.H,
        saturation: num(tint),
        lightness: TAILWIND_STOPS.neutral,
        gamut: g,
      }).steps,
    },
    { name: "brand", steps: createRamp({ through: seed, gamut: g }).steps },
    {
      name: "red",
      steps: createRamp({ hue: 25, saturation: 0.85, gamut: g }).steps,
    },
  ];
  const bindings = shadcnBindings(
    { neutral: "neutral", primary: "brand", destructive: "red" },
    ramps,
  );
  const audit = auditTokenSet({ ramps, gamut: g, ...bindings });

  const colorOf = (audits: readonly TokenAudit[]) => (on: string) => {
    const a = audits.find((x) => x.token === on);
    return a === undefined || a.outcome.kind === "unresolved"
      ? null
      : formatOklch(a.outcome.resolved.color);
  };
  const lightOf = colorOf(audit.light);
  const darkOf = colorOf(audit.dark);
  const rows = audit.light.map((l, i) => {
    const d = audit.dark[i]!;
    return `<tr><td>${l.token}</td>${chip(l.outcome, lightOf)}<td>${verdict(l)}</td>${chip(d.outcome, darkOf)}<td>${verdict(d)}</td></tr>`;
  });
  const strip = (r: Ramp) =>
    `<div class="strip" style="background:linear-gradient(to right, ${r.steps.map(formatOklch).join(",")})"></div>`;
  const shipped =
    audit.set === null
      ? `<pre class="refusal">${audit.problems.concat(["not every token clears; nothing ships"]).join("\n")}</pre>`
      : `<pre>${tokenSetToShadcnCss(audit.set, { radius: "0.625rem" })}</pre>
         <pre>${JSON.stringify(tokenSetToRegistryItem(audit.set, { name: "brand" }), null, 2)}</pre>`;
  return `
    ${ramps.map(strip).join("")}
    <div class="wrap"><table>
      <tr><th>token</th><th colspan="2">light</th><th colspan="2">dark</th></tr>
      ${rows.join("")}
    </table></div>
    <pre>${audit.passes ? "every token clears" : "does not pass"} · ${audit.light.length} tokens · gamut ${g}</pre>
    ${shipped}`;
});
