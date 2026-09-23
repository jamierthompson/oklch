import { describe, expect, it } from "vitest";

import { parseColor } from "@jamiethompson/oklch";

import {
  auditOf,
  safeSeed,
  withRamp,
  withRecipe,
  withStep,
  type Recipe,
  type Theme,
} from "./theme.ts";
import { themeFromPreset, presetOf, PRESETS } from "./presets.ts";

const preset = (id: string) => PRESETS.find((p) => p.id === id)!;

describe("PRESETS", () => {
  it("has 32 presets, each with a unique id and a reason", () => {
    expect(PRESETS).toHaveLength(32);
    expect(new Set(PRESETS.map((t) => t.id)).size).toBe(32);
    for (const t of PRESETS) expect(t.why.length).toBeGreaterThan(20);
  });

  it("every preset builds and clears every pairing", () => {
    for (const t of PRESETS) {
      const b = themeFromPreset(t);
      expect(b.name).toBe(t.name);
      expect(b.harmony).toBe(t.harmony);
      const audit = auditOf(b);
      const failing = [...audit.light, ...audit.dark]
        .filter((a) => a.outcome.kind !== "clears")
        .map((a) => `${a.scheme}/${a.token}`);
      expect(failing, `${t.name} does not clear`).toEqual([]);
    }
  });

  it("the Raiders have no hue: no harmony ramps, a true gray neutral", () => {
    const lv = themeFromPreset(preset("lv"));
    expect(lv.ramps.map((r) => r.name)).toEqual([
      "primary",
      "secondary",
      "neutral",
      "red",
    ]);
    expect(lv.ramps.find((r) => r.name === "neutral")!.steps[5]!.C).toBe(0);
  });
});

describe("presetOf", () => {
  it("writes the recipe back, with only the steps the eye moved", () => {
    const kc = themeFromPreset(preset("kc"));
    const text = presetOf(kc);
    expect(text).toContain('id: "kc"');
    expect(text).toContain('primary: "#e31837"');
    expect(text).toContain('secondary: "#ffb81c"');
    expect(text).toContain('harmony: "analogous"');
    expect(text).not.toContain("moves:");
    const moved = withStep(kc, "primary", 5, { L: 0.6, C: 0.2, H: 22 });
    const after = presetOf(moved);
    expect(after).toContain("moves: [");
    expect(after).toContain(
      '{ ramp: "primary", step: 5, to: { L: 0.6, C: 0.2, H: 22 } }, // 500',
    );
    expect(after.split("{ ramp:").length - 1).toBe(1);
  });

  it("names a theme that is not a preset by its name", () => {
    const b: Theme = { ...themeFromPreset(preset("kc")), name: "Acme Co" };
    expect(presetOf(b)).toContain('id: "acme-co"');
  });
});

describe("recipes", () => {
  const teal: Recipe = {
    kind: "through",
    color: safeSeed(parseColor("#14b8a6")!, "srgb"),
    stops: "chromatic",
  };
  const red: Recipe = {
    kind: "hue",
    hue: 10,
    saturation: 0.9,
    stops: "chromatic",
  };

  it("are written back as the ramps drawn by hand, and read as them", () => {
    const kc = themeFromPreset(preset("kc"));
    const b = withRamp(withRecipe(kc, "red", red), "teal", teal);
    const text = presetOf(b);
    expect(text).toContain(
      '"red": { kind: "hue", hue: 10, saturation: 0.9, stops: "chromatic" }',
    );
    expect(text).toContain('"teal": { kind: "through", color: { L: ');
    // Nothing was moved off what the recipes draw, so no moves are written.
    expect(text).not.toContain("moves:");
    const back = themeFromPreset({
      ...preset("kc"),
      recipes: { red, teal },
      roles: { accent: "teal" },
    });
    expect(back.ramps.map((r) => r.name)).toEqual(b.ramps.map((r) => r.name));
    expect(back.ramps.find((r) => r.name === "red")!.recipe).toEqual(red);
    expect(back.ramps.find((r) => r.name === "teal")!.steps).toEqual(
      b.ramps.find((r) => r.name === "teal")!.steps,
    );
    expect(back.assignment).toEqual({ accent: "teal" });
  });

  it("diff the moves against what the recipe draws, not the seeds", () => {
    const b = withRecipe(themeFromPreset(preset("kc")), "red", red);
    const moved = withStep(b, "red", 5, { L: 0.6, C: 0.2, H: 12 });
    const text = presetOf(moved);
    expect(text.split("{ ramp:").length - 1).toBe(1);
    expect(text).toContain(
      '{ ramp: "red", step: 5, to: { L: 0.6, C: 0.2, H: 12 } }',
    );
  });
});
