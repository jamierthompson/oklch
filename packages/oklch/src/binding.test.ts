import { describe, expect, it } from "vitest";

import { CONTRAST_TARGETS, inGamut } from "./tier1.js";
import {
  buildTokenSet,
  resolveBinding,
  STANDARDS,
  type Ramp,
  type TokenSetSpec,
} from "./binding.js";

const NEUTRAL: Ramp = {
  name: "neutral",
  steps: [0.98, 0.92, 0.8, 0.6, 0.45, 0.3, 0.15].map((L) => ({
    L,
    C: 0.005,
    H: 260,
  })),
};
const BLUE: Ramp = {
  name: "blue",
  steps: [
    { L: 0.9, C: 0.03, H: 260 },
    { L: 0.75, C: 0.1, H: 260 },
    { L: 0.6, C: 0.15, H: 260 },
    { L: 0.45, C: 0.2, H: 262 },
  ],
};
const LIGHT = [
  { token: "surface", ramp: "neutral", step: 0 },
  {
    token: "ink",
    ramp: "neutral",
    on: "surface",
    target: CONTRAST_TARGETS.bodyText,
  },
  {
    token: "ink-muted",
    ramp: "neutral",
    on: "surface",
    target: CONTRAST_TARGETS.largeText,
  },
  {
    token: "accent",
    ramp: "blue",
    on: "surface",
    target: CONTRAST_TARGETS.interfaceElement,
  },
] as const;
const DARK = [
  { token: "surface", ramp: "neutral", step: 6 },
  {
    token: "ink",
    ramp: "neutral",
    on: "surface",
    target: CONTRAST_TARGETS.bodyText,
    from: "end",
  },
  {
    token: "ink-muted",
    ramp: "neutral",
    on: "surface",
    target: CONTRAST_TARGETS.largeText,
    from: "end",
  },
  {
    token: "accent",
    ramp: "blue",
    on: "surface",
    target: CONTRAST_TARGETS.interfaceElement,
    from: "end",
  },
] as const;
const SPEC: TokenSetSpec = {
  ramps: [NEUTRAL, BLUE],
  gamut: "srgb",
  light: LIGHT,
  dark: DARK,
};

describe("resolveBinding", () => {
  const context = {
    ramps: SPEC.ramps,
    tokens: [],
    scheme: "light" as const,
    gamut: "srgb" as const,
  };

  it("picks a step by eye and reports the map and the fallback", () => {
    const surface = resolveBinding(
      { token: "surface", ramp: "neutral", step: 0 },
      context,
    );
    expect(surface.how).toBe("picked");
    expect(surface.requested).toEqual(NEUTRAL.steps[0]);
    expect(surface.color).toEqual(surface.map.color);
    expect(surface.fallback.moved).toBe(false);
    expect(surface.receipt).toBeNull();
  });

  it("solves the first step that clears on a bound surface, with a receipt", () => {
    const surface = resolveBinding(
      { token: "surface", ramp: "neutral", step: 0 },
      context,
    );
    const ink = resolveBinding(
      {
        token: "ink",
        ramp: "neutral",
        on: "surface",
        target: CONTRAST_TARGETS.bodyText,
      },
      { ...context, tokens: [surface] },
    );
    expect(ink.how).toBe("solved");
    expect(ink.step).toBeGreaterThan(0);
    expect(ink.receipt).not.toBeNull();
    expect(ink.receipt!.on).toBe("surface");
    expect(ink.receipt!.scheme).toBe("light");
    expect(ink.receipt!.wcag.passes).toBe(true);
    expect(ink.receipt!.apca.passes).toBe(true);
    expect(ink.receipt!.wcag.standard).toBe(STANDARDS.wcag);
    expect(ink.receipt!.apca.standard).toBe(STANDARDS.apca);
    expect(ink.receipt!.measured).toEqual({
      token: ink.fallback.color,
      on: surface.fallback.color,
    });
  });

  it("verifies a pick against its surface and refuses one that fails, naming the numbers", () => {
    const surface = resolveBinding(
      { token: "surface", ramp: "neutral", step: 0 },
      context,
    );
    const bound = { ...context, tokens: [surface] };
    const ok = resolveBinding(
      {
        token: "ink",
        ramp: "neutral",
        step: 6,
        on: "surface",
        target: CONTRAST_TARGETS.bodyText,
      },
      bound,
    );
    expect(ok.how).toBe("picked");
    expect(ok.receipt!.wcag.passes).toBe(true);
    expect(() =>
      resolveBinding(
        {
          token: "ink",
          ramp: "neutral",
          step: 1,
          on: "surface",
          target: CONTRAST_TARGETS.bodyText,
        },
        bound,
      ),
    ).toThrow(
      /^resolveBinding: token "ink" \(neutral\[1\]\) on "surface" measures WCAG 1\.\d\d against 4.5/,
    );
  });

  it("refuses an unknown ramp, a step outside it, and an unbound surface", () => {
    expect(() =>
      resolveBinding({ token: "x", ramp: "red", step: 0 }, context),
    ).toThrow(/names ramp "red", which is not one of: neutral, blue/);
    expect(() =>
      resolveBinding({ token: "x", ramp: "blue", step: 4 }, context),
    ).toThrow(/picks step 4 of ramp "blue", which has steps 0 to 3/);
    expect(() =>
      resolveBinding({ token: "x", ramp: "blue", step: 1.5 }, context),
    ).toThrow(/step 1.5/);
    expect(() =>
      resolveBinding(
        {
          token: "x",
          ramp: "blue",
          on: "surface",
          target: CONTRAST_TARGETS.bodyText,
        },
        context,
      ),
    ).toThrow(/sits on "surface", which is not bound yet/);
  });

  it("refuses `from` on a pick", () => {
    expect(() =>
      resolveBinding(
        { token: "x", ramp: "blue", step: 0, from: "end" },
        context,
      ),
    ).toThrow(/picks step 0 and also says from: "end"; `from` is for a solve/);
  });

  it("refuses a surface without a target, a target without a surface, and neither a step nor a pairing", () => {
    expect(() =>
      resolveBinding(
        { token: "x", ramp: "blue", step: 0, on: "surface" },
        context,
      ),
    ).toThrow(/a surface but no target/);
    expect(() =>
      resolveBinding(
        {
          token: "x",
          ramp: "blue",
          step: 0,
          target: CONTRAST_TARGETS.bodyText,
        },
        context,
      ),
    ).toThrow(/a target but no surface/);
    expect(() => resolveBinding({ token: "x", ramp: "blue" }, context)).toThrow(
      /has no `step` to pick and no `on` \+ `target` to solve for/,
    );
  });

  it("refuses a token name that is not a CSS identifier, and a duplicate", () => {
    expect(() =>
      resolveBinding({ token: "1st", ramp: "blue", step: 0 }, context),
    ).toThrow(/token "1st" is not a CSS identifier/);
    expect(() =>
      resolveBinding({ token: "a b", ramp: "blue", step: 0 }, context),
    ).toThrow(/"a b"/);
    const first = resolveBinding(
      { token: "accent", ramp: "blue", step: 0 },
      context,
    );
    expect(() =>
      resolveBinding(
        { token: "accent", ramp: "blue", step: 1 },
        { ...context, tokens: [first] },
      ),
    ).toThrow(/token "accent" is already bound/);
  });

  it("throws by name when a solve finds nothing, with no fallback color", () => {
    const surface = resolveBinding(
      { token: "surface", ramp: "neutral", step: 0 },
      context,
    );
    expect(() =>
      resolveBinding(
        {
          token: "ink",
          ramp: "neutral",
          on: "surface",
          target: { wcag: 30, apca: 200 },
        },
        { ...context, tokens: [surface] },
      ),
    ).toThrow(
      /^resolveBinding: token "ink" cannot be solved on "surface": minPass: none of the 7 steps clears/,
    );
  });

  it("throws on a missing gamut", () => {
    expect(() =>
      resolveBinding(
        { token: "x", ramp: "blue", step: 0 },
        // @ts-expect-error the contract under test
        { ramps: SPEC.ramps, tokens: [], scheme: "light" },
      ),
    ).toThrow(/^resolveBinding: gamut is undefined/);
  });

  it("throws on a scheme that is not light or dark", () => {
    expect(() =>
      resolveBinding(
        { token: "x", ramp: "blue", step: 0 },
        // @ts-expect-error the contract under test
        { ramps: SPEC.ramps, tokens: [], scheme: "dim", gamut: "srgb" },
      ),
    ).toThrow(/^resolveBinding: scheme is dim; pass "light" or "dark"/);
  });
});

describe("buildTokenSet", () => {
  it("resolves both schemes in order and pairs every token", () => {
    const set = buildTokenSet(SPEC);
    expect(set.gamut).toBe("srgb");
    expect(set.tokens.map((t) => t.token)).toEqual([
      "surface",
      "ink",
      "ink-muted",
      "accent",
    ]);
    for (const pair of set.tokens) {
      expect(pair.light.token).toBe(pair.token);
      expect(pair.dark.token).toBe(pair.token);
    }
    const surface = set.tokens[0]!;
    expect(surface.light.color.L).toBeGreaterThan(surface.dark.color.L);
  });

  it("collects one receipt per pairing per scheme, light first", () => {
    const set = buildTokenSet(SPEC);
    expect(set.receipts.map((r) => `${r.scheme}:${r.token}`)).toEqual([
      "light:ink",
      "light:ink-muted",
      "light:accent",
      "dark:ink",
      "dark:ink-muted",
      "dark:accent",
    ]);
    for (const r of set.receipts) {
      expect(r.on).toBe("surface");
      expect(r.wcag.passes && r.apca.passes).toBe(true);
    }
    expect(set.receipts[0]!.apca.polarity).toBe("dark-on-light");
    expect(set.receipts[3]!.apca.polarity).toBe("light-on-dark");
  });

  it("is nothing more than resolveBinding in order, per scheme", () => {
    const set = buildTokenSet(SPEC);
    for (const scheme of ["light", "dark"] as const) {
      const tokens: ReturnType<typeof resolveBinding>[] = [];
      for (const b of SPEC[scheme]) {
        tokens.push(
          resolveBinding(b, {
            ramps: SPEC.ramps,
            tokens,
            scheme,
            gamut: SPEC.gamut,
          }),
        );
      }
      expect(set.tokens.map((t) => t[scheme])).toEqual(tokens);
    }
  });

  it("solves each scheme on its own surface: dark ink lands on a light step", () => {
    const set = buildTokenSet(SPEC);
    const ink = set.tokens.find((t) => t.token === "ink")!;
    expect(ink.light.step).toBeGreaterThan(3);
    expect(ink.dark.step).toBeLessThan(3);
  });

  it("walks from the end for a dark scheme, so muted stays muted", () => {
    const set = buildTokenSet(SPEC);
    const ink = set.tokens.find((t) => t.token === "ink")!;
    const muted = set.tokens.find((t) => t.token === "ink-muted")!;
    expect(muted.dark.step).toBeGreaterThan(ink.dark.step);
    expect(muted.light.step).toBeLessThan(ink.light.step);
    const fromStart = buildTokenSet({
      ...SPEC,
      dark: DARK.map((b) =>
        "from" in b ? { ...b, from: "start" as const } : b,
      ),
    });
    expect(
      fromStart.tokens.find((t) => t.token === "ink-muted")!.dark.step,
    ).toBe(0);
  });

  it("refuses a token bound in only one scheme, by name", () => {
    expect(() => buildTokenSet({ ...SPEC, dark: DARK.slice(0, 3) })).toThrow(
      /^buildTokenSet: every token needs both schemes to ship as light-dark\(\): "accent" has no dark binding/,
    );
    expect(() =>
      buildTokenSet({
        ...SPEC,
        dark: [...DARK, { token: "extra", ramp: "blue", step: 0 }],
      }),
    ).toThrow(/"extra" has no light binding/);
  });

  it("builds for P3 and measures on the sRGB fallback", () => {
    const set = buildTokenSet({
      ...SPEC,
      gamut: "p3",
      ramps: [
        NEUTRAL,
        {
          name: "blue",
          steps: [
            { L: 0.5, C: 0.27, H: 262 },
            { L: 0.75, C: 0.15, H: 262 },
          ],
        },
      ],
    });
    const accent = set.tokens.find((t) => t.token === "accent")!;
    expect(accent.light.step).toBe(0);
    expect(accent.dark.step).toBe(1);
    expect(inGamut(accent.light.color, "p3")).toBe(true);
    expect(accent.light.fallback.moved).toBe(true);
    expect(accent.light.receipt!.measured.token).toEqual(
      accent.light.fallback.color,
    );
  });

  it("throws on an empty scheme", () => {
    expect(() => buildTokenSet({ ...SPEC, dark: [] })).toThrow(
      /^buildTokenSet: the dark scheme has no bindings; light and dark are one set/,
    );
  });

  it("throws on a missing gamut by its own name", () => {
    // @ts-expect-error the contract under test
    expect(() => buildTokenSet({ ...SPEC, gamut: undefined })).toThrow(
      /^buildTokenSet: gamut is undefined/,
    );
  });

  it("propagates a binding's refusal", () => {
    expect(() => buildTokenSet({ ...SPEC, light: [LIGHT[1]] })).toThrow(
      /sits on "surface", which is not bound yet/,
    );
  });
});
