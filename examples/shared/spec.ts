import {
  CONTRAST_TARGETS,
  formatOklch,
  parseColor,
  type Binding,
  type Ramp,
  type ResolvedToken,
  type TokenSet,
} from "@jamiethompson/oklch";

/** The spec a page edits: ramps as CSS color strings, bindings by target name. */
export interface PageSpec {
  ramps: Record<string, string[]>;
  bindings: (Omit<Binding, "target"> & {
    target?: keyof typeof CONTRAST_TARGETS;
  })[];
}

export const DEFAULT_SPEC: PageSpec = {
  ramps: {
    neutral: [
      "oklch(0.98 0.005 260)",
      "oklch(0.92 0.005 260)",
      "oklch(0.8 0.005 260)",
      "oklch(0.6 0.005 260)",
      "oklch(0.45 0.005 260)",
      "oklch(0.3 0.005 260)",
      "oklch(0.15 0.005 260)",
    ],
    blue: [
      "oklch(0.9 0.03 260)",
      "oklch(0.75 0.1 260)",
      "oklch(0.6 0.15 260)",
      "oklch(0.5 0.27 262)",
    ],
  },
  bindings: [
    { token: "surface", ramp: "neutral", step: 0 },
    { token: "ink", ramp: "neutral", on: "surface", target: "bodyText" },
    { token: "ink-muted", ramp: "neutral", on: "surface", target: "largeText" },
    {
      token: "accent",
      ramp: "blue",
      on: "surface",
      target: "interfaceElement",
    },
  ],
};

export function specText(spec: PageSpec = DEFAULT_SPEC): string {
  return JSON.stringify(spec, null, 2);
}

/** Read the page spec, naming what is wrong with it. */
export function readSpec(text: string): { ramps: Ramp[]; bindings: Binding[] } {
  const spec = JSON.parse(text) as PageSpec;
  const ramps = Object.entries(spec.ramps).map(([name, steps]) => ({
    name,
    steps: steps.map((s, i) => {
      const c = parseColor(s);
      if (c === null)
        throw new Error(`ramp "${name}" step ${i}: parseColor("${s}") is null`);
      return c;
    }),
  }));
  const bindings = spec.bindings.map((b) => {
    if (b.target === undefined) {
      const rest: Binding = { token: b.token, ramp: b.ramp };
      return {
        ...rest,
        ...(b.step === undefined ? {} : { step: b.step }),
        ...(b.on === undefined ? {} : { on: b.on }),
      };
    }
    const target = CONTRAST_TARGETS[b.target];
    if (target === undefined)
      throw new Error(
        `binding "${b.token}": target "${b.target}" is not one of ${Object.keys(CONTRAST_TARGETS).join(", ")}`,
      );
    return { ...b, target };
  });
  return { ramps, bindings };
}

export function tokenRow(t: ResolvedToken, set: TokenSet): string {
  const surface =
    t.receipt === null
      ? null
      : set.tokens.find((s) => s.token === t.receipt!.on)!;
  const chip =
    surface === null
      ? `<div style="background:${formatOklch(t.color)}"></div>`
      : `<div style="background:${formatOklch(surface.color)};color:${formatOklch(t.color)};width:auto;padding:0 8px;font-weight:600">Aa</div>`;
  const receipt =
    t.receipt === null
      ? "—"
      : `on ${t.receipt.on}: WCAG ${t.receipt.wcag.value.toFixed(2)} ≥ ${t.receipt.target.wcag}, APCA ${t.receipt.apca.value.toFixed(1)} ≥ ${t.receipt.target.apca}`;
  return `<tr>
    <td>${t.token}</td>
    <td class="chip">${chip}</td>
    <td>${t.ramp}[${t.step}] ${t.how}</td>
    <td>${t.map.moved ? "mapped " + t.map.deltaEOK.toFixed(3) : ""}${t.fallback.moved ? " · sRGB " + t.fallback.deltaEOK.toFixed(3) : ""}</td>
    <td>${receipt}</td>
  </tr>`;
}

export function tokenTable(set: TokenSet): string {
  return `<div class="wrap"><table>
    <tr><th>token</th><th></th><th>from</th><th>moved</th><th>receipt</th></tr>
    ${set.tokens.map((t) => tokenRow(t, set)).join("")}
  </table></div>`;
}
