import { SHADCN_TOKENS, TAILWIND_STOPS } from "@jamiethompson/oklch";
import { describe, expect, it } from "vitest";

import {
  auditOf,
  bindingsOf,
  cssVarsOf,
  newBrand,
  parse,
  rampOf,
  rolesOf,
  serialize,
  snapTo,
  withOverride,
  withoutRamp,
  withRamp,
  withRole,
  withSeed,
  withStep,
} from "./brand.ts";

const acme = () => newBrand("Acme", "#2563eb", "srgb");

describe("newBrand", () => {
  it("drafts a tinted neutral, the brand ramp through the seed, and a red", () => {
    const b = acme();
    expect(b.ramps.map((r) => r.name)).toEqual(["neutral", "brand", "red"]);
    for (const r of b.ramps) expect(r.steps).toHaveLength(11);
    expect(b.ramps[0]!.steps.map((s) => s.L)).toEqual([
      ...TAILWIND_STOPS.neutral,
    ]);
    expect(b.ramps[0]!.steps[5]!.C).toBeGreaterThan(0.005);
    expect(b.ramps[1]!.seed).toEqual({
      kind: "through",
      color: "#2563eb",
      stops: "chromatic",
      hueShift: 0,
    });
    expect(b.assignment).toEqual({
      neutral: "neutral",
      primary: "brand",
      destructive: "red",
    });
  });

  it("passes the audit out of the box", () => {
    const audit = auditOf(acme());
    expect(audit.passes).toBe(true);
    expect(audit.light.map((a) => a.token)).toEqual([...SHADCN_TOKENS]);
  });

  it("refuses a seed that is not a color", () => {
    expect(() => newBrand("x", "blue-ish", "srgb")).toThrow(/not a color/);
  });
});

describe("roles", () => {
  it("default a chart series to the primary ramp and the rest to the neutral", () => {
    const b = acme();
    expect(rampOf(b, "chart-3")).toBe("brand");
    expect(rampOf(b, "sidebar")).toBe("neutral");
    expect(rampOf(b, "ring")).toBe("neutral");
    expect(rolesOf(b, "red")).toEqual(["destructive"]);
    expect(rolesOf(b, "brand")).toEqual([
      "primary",
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ]);
  });

  it("put every token of a role on the role's ramp", () => {
    const b = withRole(withRole(acme(), "chart-2", "red"), "sidebar", "brand");
    const light = bindingsOf(b).light;
    expect(light.find((x) => x.token === "chart-2")!.ramp).toBe("red");
    expect(light.find((x) => x.token === "chart-1")!.ramp).toBe("brand");
    expect(light.find((x) => x.token === "sidebar")!.ramp).toBe("brand");
    expect(light.find((x) => x.token === "sidebar-border")!.ramp).toBe("brand");
    expect(() => withRole(b, "ring", "teal")).toThrow(/no ramp named "teal"/);
  });
});

describe("overrides", () => {
  it("replace the preset's step but keep its ramp, surface and target", () => {
    const b = withOverride(acme(), "light", "primary", { step: 3 });
    const primary = bindingsOf(b).light.find((x) => x.token === "primary")!;
    expect(primary).toEqual({
      token: "primary",
      ramp: "brand",
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
    expect(snapped).not.toBeNull();
    expect(snapped).toEqual({ step: expect.any(Number) });
    const b = withOverride(failing, "light", "primary", snapped);
    expect(
      auditOf(b).light.find((a) => a.token === "primary")!.outcome.kind,
    ).toBe("clears");
  });
});

describe("ramps", () => {
  it("moves one step by eye and leaves the seed for a regenerate", () => {
    const b = withStep(acme(), "brand", 5, { L: 0.5, C: 0.1, H: 200 });
    expect(b.ramps[1]!.steps[5]).toEqual({ L: 0.5, C: 0.1, H: 200 });
    expect(b.ramps[1]!.steps[4]).toEqual(acme().ramps[1]!.steps[4]);
    const again = withSeed(b, "brand", b.ramps[1]!.seed);
    expect(again.ramps[1]!.steps).toEqual(acme().ramps[1]!.steps);
  });

  it("adds a ramp and refuses a duplicate or bad name", () => {
    const seed = {
      kind: "hue",
      hue: 150,
      saturation: 0.7,
      stops: "chromatic",
      hueShift: 0,
    } as const;
    const b = withRamp(acme(), "green", seed);
    expect(b.ramps.at(-1)!.name).toBe("green");
    expect(() => withRamp(b, "green", seed)).toThrow(/already exists/);
    expect(() => withRamp(b, "Green", seed)).toThrow(/lowercase/);
  });

  it("removes a ramp only when it plays no role", () => {
    const seed = {
      kind: "hue",
      hue: 150,
      saturation: 0.7,
      stops: "chromatic",
      hueShift: 0,
    } as const;
    const b = withRamp(acme(), "green", seed);
    expect(withoutRamp(b, "green").ramps).toHaveLength(3);
    expect(() => withoutRamp(b, "brand")).toThrow(/plays primary, chart-1/);
    const charted = withRole(b, "chart-1", "green");
    expect(() => withoutRamp(charted, "green")).toThrow(/plays chart-1;/);
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

describe("serialize and parse", () => {
  it("round-trips", () => {
    const b = acme();
    expect(parse(serialize(b))).toEqual(b);
  });

  it("reads a version 1 file, dropping the ramp each override named", () => {
    const b = acme();
    const v1 = {
      ...b,
      version: 1,
      assignment: { ...b.assignment, charts: undefined },
      overrides: {
        light: { primary: { ramp: "brand", step: 7 } },
        dark: { ring: { ramp: "brand", solve: true, from: "end" } },
      },
    };
    expect(parse(JSON.stringify(v1))).toEqual({
      ...b,
      overrides: {
        light: { primary: { step: 7 } },
        dark: { ring: { solve: true, from: "end" } },
      },
    });
  });

  it("names what is wrong", () => {
    expect(() => parse("[]")).toThrow(/version/);
    expect(() => parse(JSON.stringify({ ...acme(), version: 3 }))).toThrow(
      /version 3 is not 2/,
    );
    expect(() =>
      parse(JSON.stringify({ ...acme(), gamut: "rec2020" })),
    ).toThrow(/gamut rec2020/);
    expect(() =>
      parse(
        JSON.stringify({
          ...acme(),
          assignment: { neutral: "gray", primary: "brand", destructive: "red" },
        }),
      ),
    ).toThrow(/neutral names ramp "gray"/);
    expect(() =>
      parse(JSON.stringify({ ...acme(), assignment: { neutral: "gray" } })),
    ).toThrow(/primary names no ramp/);
    const b = acme();
    expect(() =>
      parse(
        JSON.stringify({
          ...b,
          assignment: { ...b.assignment, "chart-6": "brand" },
        }),
      ),
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
