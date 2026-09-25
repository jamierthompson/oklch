import { describe, expect, it } from "vitest";

import { auditOf, withStep, type Theme } from "./theme.ts";
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
