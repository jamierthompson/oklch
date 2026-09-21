import { describe, expect, it } from "vitest";

import { CONTRAST_TARGETS } from "./tier1.js";
import { createRamp, TAILWIND_STOPS } from "./tier2.js";
import { auditTokenSet } from "./audit.js";
import { buildTokenSet, type Ramp } from "./binding.js";
import { SHADCN_TOKENS, shadcnBindings } from "./shadcn.js";

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
