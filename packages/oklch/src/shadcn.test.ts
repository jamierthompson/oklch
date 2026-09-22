import { describe, expect, it } from "vitest";

import { CONTRAST_TARGETS, formatOklch } from "./tier1.js";
import { createRamp, TAILWIND_STOPS } from "./tier2.js";
import { auditTokenSet } from "./audit.js";
import { buildTokenSet, type Ramp } from "./binding.js";
import {
  SHADCN_CHART_STEPS,
  SHADCN_TOKENS,
  shadcnBindings,
  tokenSetToRegistryItem,
  tokenSetToShadcnCss,
} from "./shadcn.js";

const ramp = (
  name: string,
  hue: number,
  saturation: number,
  lightness: readonly number[] = TAILWIND_STOPS.chromatic,
): Ramp => ({
  name,
  steps: createRamp({ hue, saturation, lightness, gamut: "srgb" }).steps,
});
const RAMPS = [
  ramp("gray", 260, 0.05, TAILWIND_STOPS.neutral),
  ramp("blue", 260, 0.85),
  ramp("red", 25, 0.85),
  ramp("teal", 180, 0.7),
];
const ASSIGNMENT = {
  neutral: "gray",
  primary: "blue",
  destructive: "red",
} as const;

describe("shadcnBindings", () => {
  it("binds every shadcn token once per scheme, in dependency order", () => {
    const { light, dark } = shadcnBindings(ASSIGNMENT, RAMPS);
    expect(light.map((b) => b.token)).toEqual([...SHADCN_TOKENS]);
    expect(dark.map((b) => b.token)).toEqual([...SHADCN_TOKENS]);
    for (const scheme of [light, dark]) {
      const seen = new Set<string>();
      for (const b of scheme) {
        if (b.on !== undefined)
          expect(seen, `${b.token} on ${b.on}`).toContain(b.on);
        seen.add(b.token);
      }
    }
  });

  it("solves every foreground for body text on its surface, and picks the surfaces", () => {
    const { light } = shadcnBindings(ASSIGNMENT, RAMPS);
    for (const b of light) {
      if (b.token.endsWith("-foreground") || b.token === "foreground") {
        expect(b.step).toBeUndefined();
        expect(b.target).toEqual(CONTRAST_TARGETS.bodyText);
        expect(b.on).toBe(b.token.replace(/-?foreground$/, "") || "background");
      }
    }
    expect(light.find((b) => b.token === "background")).toEqual({
      token: "background",
      ramp: "gray",
      step: 0,
    });
  });

  it("holds primary and destructive to the non-text bar on their surface, and solves the rings for it", () => {
    const { light } = shadcnBindings(ASSIGNMENT, RAMPS);
    for (const [token, on] of [
      ["primary", "background"],
      ["destructive", "background"],
      ["sidebar-primary", "sidebar"],
    ]) {
      const b = light.find((x) => x.token === token)!;
      expect(b.on).toBe(on);
      expect(b.target).toEqual(CONTRAST_TARGETS.interfaceElement);
      expect(b.step).toBeDefined();
    }
    for (const [token, on] of [
      ["ring", "background"],
      ["sidebar-ring", "sidebar"],
    ]) {
      const b = light.find((x) => x.token === token)!;
      expect(b).toEqual({
        token,
        ramp: "gray",
        on,
        target: CONTRAST_TARGETS.interfaceElement,
        from: "start",
      });
    }
  });

  it("leaves borders, inputs, and chart series without a target", () => {
    const { light } = shadcnBindings(ASSIGNMENT, RAMPS);
    for (const token of [
      "border",
      "input",
      "sidebar-border",
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ]) {
      const b = light.find((x) => x.token === token)!;
      expect(b.target).toBeUndefined();
      expect(b.on).toBeUndefined();
      expect(b.step).toBeDefined();
    }
  });

  it("defaults secondary and accent to the neutral ramp, and takes overrides", () => {
    const defaults = shadcnBindings(ASSIGNMENT, RAMPS).light;
    expect(defaults.find((b) => b.token === "secondary")!.ramp).toBe("gray");
    expect(defaults.find((b) => b.token === "accent")!.ramp).toBe("gray");
    const custom = shadcnBindings(
      { ...ASSIGNMENT, accent: "teal", secondary: "teal" },
      RAMPS,
    ).light;
    expect(custom.find((b) => b.token === "accent")!.ramp).toBe("teal");
    expect(custom.find((b) => b.token === "sidebar-accent")!.ramp).toBe("teal");
    expect(custom.find((b) => b.token === "secondary")!.ramp).toBe("teal");
  });

  it("puts the sidebar and the focus rings on their own ramps when given", () => {
    const defaults = shadcnBindings(ASSIGNMENT, RAMPS).light;
    expect(defaults.find((b) => b.token === "sidebar")!.ramp).toBe("gray");
    expect(defaults.find((b) => b.token === "ring")!.ramp).toBe("gray");
    const custom = shadcnBindings(
      { ...ASSIGNMENT, sidebar: "blue", ring: "blue" },
      RAMPS,
    ).light;
    for (const token of ["sidebar", "sidebar-border", "ring", "sidebar-ring"]) {
      expect(custom.find((b) => b.token === token)!.ramp, token).toBe("blue");
    }
    // The sidebar's ink still comes from the neutral, solved on the new surface.
    const ink = custom.find((b) => b.token === "sidebar-foreground")!;
    expect(ink.ramp).toBe("gray");
    expect(ink.on).toBe("sidebar");
  });

  it("charts default to SHADCN_CHART_STEPS of the primary ramp", () => {
    const { light, dark } = shadcnBindings(ASSIGNMENT, RAMPS);
    for (const [scheme, bindings] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      SHADCN_CHART_STEPS[scheme].forEach((step, i) => {
        expect(bindings.find((b) => b.token === `chart-${i + 1}`)).toEqual({
          token: `chart-${i + 1}`,
          ramp: "blue",
          step,
        });
      });
    }
  });

  it("takes the chart series as given, per scheme", () => {
    const step = (ramp: string, step: number) => ({ ramp, step });
    const charts = {
      light: [
        step("blue", 5),
        step("red", 5),
        step("teal", 5),
        step("gray", 5),
        step("blue", 8),
      ],
      dark: [
        step("blue", 3),
        step("red", 3),
        step("teal", 3),
        step("gray", 3),
        step("blue", 1),
      ],
    } as const;
    const { light, dark } = shadcnBindings({ ...ASSIGNMENT, charts }, RAMPS);
    expect(light.find((b) => b.token === "chart-2")).toEqual({
      token: "chart-2",
      ramp: "red",
      step: 5,
    });
    expect(dark.find((b) => b.token === "chart-5")).toEqual({
      token: "chart-5",
      ramp: "blue",
      step: 1,
    });
  });

  it("builds a set that clears out of the box for these ramps, in both schemes", () => {
    const bindings = shadcnBindings(ASSIGNMENT, RAMPS);
    const set = buildTokenSet({ ramps: RAMPS, gamut: "srgb", ...bindings });
    expect(set.tokens).toHaveLength(SHADCN_TOKENS.length);
    // Ten inks, three non-text elements, two rings, per scheme.
    expect(set.receipts).toHaveLength(2 * 15);
    expect(
      auditTokenSet({ ramps: RAMPS, gamut: "srgb", ...bindings }).passes,
    ).toBe(true);
  });

  it("clears for a light brand hue too, because the inks are solved rather than picked", () => {
    const amber = [
      ramp("gray", 80, 0.05, TAILWIND_STOPS.neutral),
      ramp("amber", 80, 0.9),
      ramp("red", 25, 0.85),
    ];
    const bindings = shadcnBindings(
      { neutral: "gray", primary: "amber", destructive: "red" },
      amber,
    );
    const audit = auditTokenSet({ ramps: amber, gamut: "srgb", ...bindings });
    expect(audit.passes).toBe(true);
    const onPrimary = audit.light.find(
      (a) => a.token === "primary-foreground",
    )!;
    expect(onPrimary.outcome.kind).toBe("clears");
  });

  it("refuses an unknown ramp, and a ramp without eleven steps", () => {
    expect(() =>
      shadcnBindings({ ...ASSIGNMENT, primary: "green" }, RAMPS),
    ).toThrow(
      /^shadcnBindings: primary names ramp "green", which is not one of: gray, blue, red, teal/,
    );
    const short: Ramp = { name: "blue", steps: RAMPS[1]!.steps.slice(0, 7) };
    expect(() =>
      shadcnBindings(ASSIGNMENT, [RAMPS[0]!, short, RAMPS[2]!]),
    ).toThrow(
      /^shadcnBindings: ramp "blue" has 7 steps; the preset picks by Tailwind's eleven stops/,
    );
  });
});

describe("tokenSetToShadcnCss", () => {
  const set = () =>
    buildTokenSet({
      ramps: RAMPS,
      gamut: "srgb",
      ...shadcnBindings(ASSIGNMENT, RAMPS),
    });

  it("emits :root, .dark, and @theme inline, one line per token, in binding order", () => {
    const css = tokenSetToShadcnCss(set());
    const blocks = css.split("\n\n");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatch(/^:root \{\n {2}--background: oklch\(/);
    expect(blocks[1]).toMatch(/^\.dark \{\n {2}--background: oklch\(/);
    expect(blocks[2]).toMatch(
      /^@theme inline \{\n {2}--color-background: var\(--background\);\n {2}--color-foreground: var\(--foreground\);/,
    );
    expect(css.endsWith("}\n")).toBe(true);
    for (const token of SHADCN_TOKENS) {
      expect(
        css.match(new RegExp(`^  --${token}: oklch\\(`, "gm")),
      ).toHaveLength(2);
      expect(css).toContain(`--color-${token}: var(--${token});`);
    }
    expect(css).not.toContain("@media");
    expect(css).not.toContain("--radius");
  });

  it("ships each scheme's sRGB fallback at full precision", () => {
    const s = set();
    const css = tokenSetToShadcnCss(s);
    const primary = s.tokens.find((t) => t.token === "primary")!;
    expect(css).toContain(
      `--primary: ${formatOklch(primary.light.fallback.color)};`,
    );
    expect(css).toContain(
      `--primary: ${formatOklch(primary.dark.fallback.color)};`,
    );
  });

  it("carries a radius on :root when asked", () => {
    expect(tokenSetToShadcnCss(set(), { radius: "0.625rem" })).toMatch(
      /^:root \{\n {2}--radius: 0.625rem;\n {2}--background/,
    );
  });

  it("redeclares only the tokens P3 moves, under the media query, for a P3 set", () => {
    const vivid = [
      ramp("gray", 260, 0.05, TAILWIND_STOPS.neutral),
      {
        name: "blue",
        steps: createRamp({ hue: 260, saturation: 1, gamut: "p3" }).steps,
      },
      {
        name: "red",
        steps: createRamp({ hue: 25, saturation: 1, gamut: "p3" }).steps,
      },
    ];
    const s = buildTokenSet({
      ramps: vivid,
      gamut: "p3",
      ...shadcnBindings(ASSIGNMENT, vivid),
    });
    const css = tokenSetToShadcnCss(s);
    const media = css.slice(css.indexOf("@media (color-gamut: p3)"));
    expect(media).toMatch(
      /^@media \(color-gamut: p3\) \{\n {2}:root \{\n {4}--/,
    );
    expect(media).toContain("\n  .dark {\n");
    const moved = s.tokens.filter((t) => t.light.fallback.moved);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.map((t) => t.token)).toContain("primary");
    expect(moved.map((t) => t.token)).not.toContain("background");
    expect(media.match(/^ {4}--[a-z0-9-]+:/gm)).toHaveLength(
      moved.length + s.tokens.filter((t) => t.dark.fallback.moved).length,
    );
  });
});

describe("tokenSetToRegistryItem", () => {
  const set = () =>
    buildTokenSet({
      ramps: RAMPS,
      gamut: "srgb",
      ...shadcnBindings(ASSIGNMENT, RAMPS),
    });

  it("is a registry:theme item with every token under light and dark, as sRGB oklch()", () => {
    const s = set();
    const item = tokenSetToRegistryItem(s, {
      name: "acme",
      title: "Acme",
      description: "Acme's palette.",
    });
    expect(item.$schema).toBe(
      "https://ui.shadcn.com/schema/registry-item.json",
    );
    expect(item.type).toBe("registry:theme");
    expect(item.name).toBe("acme");
    expect(item.title).toBe("Acme");
    expect(item.description).toBe("Acme's palette.");
    expect(Object.keys(item.cssVars.light)).toEqual([...SHADCN_TOKENS]);
    expect(Object.keys(item.cssVars.dark)).toEqual([...SHADCN_TOKENS]);
    const primary = s.tokens.find((t) => t.token === "primary")!;
    expect(item.cssVars.light["primary"]).toBe(
      formatOklch(primary.light.fallback.color),
    );
    expect(item.cssVars.dark["primary"]).toBe(
      formatOklch(primary.dark.fallback.color),
    );
    expect(JSON.parse(JSON.stringify(item))).toEqual(item);
  });

  it("leaves out a title and description that were not given", () => {
    const item = tokenSetToRegistryItem(set(), { name: "acme" });
    expect("title" in item).toBe(false);
    expect("description" in item).toBe(false);
  });

  it("refuses a name the registry would", () => {
    expect(() => tokenSetToRegistryItem(set(), { name: "Acme Theme" })).toThrow(
      /^tokenSetToRegistryItem: name "Acme Theme" is not kebab-case/,
    );
  });
});
