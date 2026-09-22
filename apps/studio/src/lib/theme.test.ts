import {
  HARMONY_KINDS,
  SHADCN_TOKENS,
  TAILWIND_STOPS,
} from "@jamiethompson/oklch";
import { describe, expect, it } from "vitest";

import {
  auditOf,
  bindingsOf,
  cssVarsOf,
  newTheme,
  parse,
  randomTheme,
  rampOf,
  rolesOf,
  serialize,
  snapTo,
  withHarmony,
  withOverride,
  withPrimary,
  withRole,
  withSecondary,
  withStep,
} from "./theme.ts";

const acme = () => newTheme("Acme", "#2563eb", "srgb");
const names = (b: ReturnType<typeof acme>) => b.ramps.map((r) => r.name);
const amber = { L: 0.7, C: 0.15, H: 70 };
const rampNamed = (b: ReturnType<typeof acme>, name: string) =>
  b.ramps.find((r) => r.name === name)!;

describe("newTheme", () => {
  it("drafts a tinted neutral, the primary through the seed, a red, and the analogous harmonies", () => {
    const b = acme();
    expect(names(b)).toEqual([
      "primary",
      "neutral",
      "red",
      "harmony-1",
      "harmony-2",
    ]);
    for (const r of b.ramps) expect(r.steps).toHaveLength(11);
    const neutral = rampNamed(b, "neutral");
    expect(neutral.steps.map((s) => s.L)).toEqual([...TAILWIND_STOPS.neutral]);
    expect(neutral.steps[5]!.C).toBeGreaterThan(0.005);
    expect(b.secondary).toBeNull();
    expect(b.harmony).toBe("analogous");
    expect(b.assignment).toEqual({});
    // The primary is a step of its ramp, exactly.
    const primary = rampNamed(b, "primary");
    expect(primary.seed).not.toBeNull();
    expect(primary.steps[primary.seed!]).toEqual(b.primary);
    // The harmonies sit at the primary's hue plus the offsets.
    const hue = (name: string) =>
      b.ramps.find((r) => r.name === name)!.steps[5]!.H;
    expect(hue("harmony-1")).toBeCloseTo((b.primary.H - 30 + 360) % 360, 0);
    expect(hue("harmony-2")).toBeCloseTo((b.primary.H + 30) % 360, 0);
  });

  it("passes the audit out of the box", () => {
    const audit = auditOf(acme());
    expect(audit.passes).toBe(true);
    expect(audit.light.map((a) => a.token)).toEqual([...SHADCN_TOKENS]);
  });

  it("refuses a seed that is not a color", () => {
    expect(() => newTheme("x", "blue-ish", "srgb")).toThrow(/not a color/);
  });
});

describe("roles", () => {
  it("default from the ramps the seeds give: accent and chart-2 on the first harmony, the rest on primary or neutral", () => {
    const b = acme();
    expect(rampOf(b, "secondary")).toBe("neutral");
    expect(rampOf(b, "accent")).toBe("harmony-1");
    expect(rampOf(b, "ring")).toBe("primary");
    expect(rampOf(b, "sidebar")).toBe("neutral");
    expect(
      ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"].map((r) =>
        rampOf(b, r as "chart-1"),
      ),
    ).toEqual(["primary", "harmony-1", "harmony-2", "primary", "primary"]);
    expect(rolesOf(b, "red")).toEqual(["destructive"]);
  });

  it("move to the secondary when a secondary seed arrives, unless the eye chose", () => {
    const b = withSecondary(acme(), amber);
    expect(names(b)).toContain("secondary");
    expect(rampOf(b, "secondary")).toBe("secondary");
    expect(rampOf(b, "chart-2")).toBe("secondary");
    expect(rampOf(b, "chart-3")).toBe("harmony-1");
    const chosen = withRole(b, "chart-3", "harmony-2");
    expect(rampOf(chosen, "chart-3")).toBe("harmony-2");
    // A choice naming a ramp the theme no longer has falls back to the default.
    expect(rampOf(withHarmony(chosen, "complementary"), "chart-3")).toBe(
      "harmony-1",
    );
    expect(() => withRole(b, "ring", "teal")).toThrow(/no ramp named "teal"/);
  });

  it("put every token of a role on the role's ramp", () => {
    const b = withRole(acme(), "sidebar", "primary");
    const light = bindingsOf(b).light;
    for (const token of ["sidebar", "sidebar-border"]) {
      expect(light.find((x) => x.token === token)!.ramp).toBe("primary");
    }
    expect(light.find((x) => x.token === "chart-2")!.ramp).toBe("harmony-1");
  });
});

describe("the seed step", () => {
  it("is the seed: moving it moves the seed, within the safe chroma, and nothing else redraws", () => {
    const b = withSecondary(acme(), amber);
    const seed = rampNamed(b, "primary").seed!;
    const harmonyBefore = rampNamed(b, "harmony-1").steps;
    const moved = withStep(b, "primary", seed, { L: 0.5, C: 0.9, H: 200 });
    const step = rampNamed(moved, "primary").steps[seed]!;
    expect(moved.primary).toEqual(step);
    expect(step.H).toBe(200);
    expect(step.C).toBeLessThan(0.9);
    expect(rampNamed(moved, "harmony-1").steps).toBe(harmonyBefore);
    // Other steps of the ramp, and the secondary's seed step, do the same.
    const other = withStep(moved, "primary", seed + 1, {
      L: 0.4,
      C: 0.1,
      H: 200,
    });
    expect(other.primary).toEqual(step);
    const s2 = rampNamed(b, "secondary").seed!;
    const sec = withStep(b, "secondary", s2, { L: 0.6, C: 0.1, H: 80 });
    expect(sec.secondary).toEqual(rampNamed(sec, "secondary").steps[s2]);
    // And a harmony change after the move still drafts, since the seed stayed safe.
    expect(() => withHarmony(moved, "triadic")).not.toThrow();
  });
});

describe("seeds", () => {
  it("a new primary redraws the primary, the neutral tint and the harmonies, and keeps the eye's steps elsewhere", () => {
    const moved = withStep(withSecondary(acme(), amber), "secondary", 5, {
      L: 0.5,
      C: 0.1,
      H: 100,
    });
    const b = withPrimary(moved, { L: 0.6, C: 0.2, H: 30 });
    expect(b.primary).toEqual({ L: 0.6, C: 0.2, H: 30 });
    expect(b.ramps.find((r) => r.name === "secondary")!.steps[5]).toEqual({
      L: 0.5,
      C: 0.1,
      H: 100,
    });
    expect(
      b.ramps.find((r) => r.name === "harmony-2")!.steps[5]!.H,
    ).toBeCloseTo(60, 0);
    expect(b.ramps.find((r) => r.name === "neutral")!.steps[5]!.H).toBeCloseTo(
      30,
      0,
    );
  });

  it("a harmony change redraws only the harmony ramps", () => {
    const moved = withStep(acme(), "primary", 5, { L: 0.5, C: 0.1, H: 200 });
    const b = withHarmony(moved, "tetradic");
    expect(names(b)).toEqual([
      "primary",
      "neutral",
      "red",
      "harmony-1",
      "harmony-2",
      "harmony-3",
    ]);
    expect(b.ramps.find((r) => r.name === "primary")!.steps[5]).toEqual({
      L: 0.5,
      C: 0.1,
      H: 200,
    });
    expect(names(withHarmony(b, "complementary"))).toEqual([
      "primary",
      "neutral",
      "red",
      "harmony-1",
    ]);
  });

  it("an achromatic primary builds the tint and the harmonies on the secondary's hue, or on nothing", () => {
    const gray = newTheme("Gray", "#475569", "srgb");
    const flat = withPrimary(gray, { L: 0.4, C: 0.005, H: 0 });
    expect(names(flat)).toEqual(["primary", "neutral", "red"]);
    expect(rampNamed(flat, "neutral").steps[5]!.C).toBe(0);
    const tinted = withSecondary(flat, amber);
    expect(names(tinted)).toEqual([
      "primary",
      "secondary",
      "neutral",
      "red",
      "harmony-1",
      "harmony-2",
    ]);
    expect(rampNamed(tinted, "neutral").steps[5]!.H).toBeCloseTo(70, 0);
    expect(auditOf(tinted).passes).toBe(true);
  });

  it("refuses a seed beyond the safe chroma at its lightness", () => {
    expect(() => withPrimary(acme(), { L: 0.9, C: 0.3, H: 250 })).toThrow(
      /safe chroma/,
    );
  });
});

describe("overrides", () => {
  it("replace the preset's step but keep its ramp, surface and target", () => {
    const b = withOverride(acme(), "light", "primary", { step: 3 });
    const primary = bindingsOf(b).light.find((x) => x.token === "primary")!;
    expect(primary).toEqual({
      token: "primary",
      ramp: "primary",
      step: 3,
      on: "background",
      target: { wcag: 3, apca: 30 },
    });
    expect(
      auditOf(b).light.find((a) => a.token === "primary")!.outcome.kind,
    ).toBe("fails");
  });

  it("can turn a pick into a solve, and clear again", () => {
    const b = withOverride(acme(), "light", "primary", {
      solve: true,
      from: "end",
    });
    const primary = bindingsOf(b).light.find((x) => x.token === "primary")!;
    expect(primary.step).toBeUndefined();
    expect(primary.from).toBe("end");
    expect(bindingsOf(withOverride(b, "light", "primary", null))).toEqual(
      bindingsOf(acme()),
    );
  });

  it("snap gives the failing token the step its solve would land on", () => {
    const failing = withOverride(acme(), "light", "primary", { step: 1 });
    const snapped = snapTo(failing, "light", "primary");
    expect(snapped).toEqual({ step: expect.any(Number) });
    const b = withOverride(failing, "light", "primary", snapped);
    expect(
      auditOf(b).light.find((a) => a.token === "primary")!.outcome.kind,
    ).toBe("clears");
  });
});

describe("cssVarsOf", () => {
  it("sets every token that has a color, plus the radius", () => {
    const vars = cssVarsOf(auditOf(acme()), "dark", "0.5rem");
    expect(vars["--radius"]).toBe("0.5rem");
    expect(Object.keys(vars)).toHaveLength(SHADCN_TOKENS.length + 1);
    expect(vars["--background"]).toMatch(/^oklch\(0\.145 /);
  });
});

describe("randomTheme", () => {
  it("has a primary, a secondary, a harmony, and ramps drafted from them, and clears", () => {
    let n = 0;
    // A fixed sequence stands in for Math.random, so the test is the same every run.
    const random = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 10; i++) {
      const t = randomTheme("Red Zone", random);
      expect(t.name).toBe("Red Zone");
      expect(t.secondary).not.toBeNull();
      expect(names(t)).toContain("secondary");
      expect(names(t).filter((r) => r.startsWith("harmony-")).length).toBe(
        HARMONY_KINDS[t.harmony].length,
      );
      const audit = auditOf(t);
      expect(
        [...audit.light, ...audit.dark].filter(
          (a) => a.outcome.kind !== "clears",
        ),
      ).toEqual([]);
    }
  });
});

describe("serialize and parse", () => {
  it("round-trips", () => {
    const b = withSecondary(acme(), amber);
    expect(parse(serialize(b))).toEqual(b);
  });

  it("names what is wrong", () => {
    const b = acme();
    expect(() => parse("[]")).toThrow(/id is not a string/);
    expect(() => parse(JSON.stringify({ ...b, gamut: "rec2020" }))).toThrow(
      /gamut rec2020/,
    );
    expect(() => parse(JSON.stringify({ ...b, primary: "#fff" }))).toThrow(
      /primary is not a color/,
    );
    expect(() => parse(JSON.stringify({ ...b, harmony: "square" }))).toThrow(
      /harmony square is not one of/,
    );
    expect(() =>
      parse(JSON.stringify({ ...b, assignment: { neutral: "gray" } })),
    ).toThrow(/neutral names ramp "gray"/);
    expect(() =>
      parse(JSON.stringify({ ...b, assignment: { "chart-6": "primary" } })),
    ).toThrow(/"chart-6" is not a role/);
    expect(() =>
      parse(
        JSON.stringify({
          ...b,
          overrides: { light: { "primary-ish": { step: 1 } }, dark: {} },
        }),
      ),
    ).toThrow(/not a shadcn token/);
    expect(() =>
      parse(
        JSON.stringify({
          ...b,
          overrides: {
            light: { primary: { solve: true, from: "middle" } },
            dark: {},
          },
        }),
      ),
    ).toThrow(/neither a step nor a solve/);
  });
});
