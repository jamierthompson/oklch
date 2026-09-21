import { describe, expect, it } from "vitest";

import { CONTRAST_TARGETS } from "./tier1.js";
import { auditTokenSet } from "./audit.js";
import { buildTokenSet, type Ramp, type TokenSetSpec } from "./binding.js";

const NEUTRAL: Ramp = {
  name: "neutral",
  steps: [0.98, 0.92, 0.8, 0.6, 0.45, 0.3, 0.15].map((L) => ({
    L,
    C: 0.005,
    H: 260,
  })),
};
const { bodyText, interfaceElement } = CONTRAST_TARGETS;

const CLEAN: TokenSetSpec = {
  ramps: [NEUTRAL],
  gamut: "srgb",
  light: [
    { token: "surface", ramp: "neutral", step: 0 },
    { token: "ink", ramp: "neutral", step: 6, on: "surface", target: bodyText },
    { token: "muted", ramp: "neutral", on: "surface", target: bodyText },
  ],
  dark: [
    { token: "surface", ramp: "neutral", step: 6 },
    { token: "ink", ramp: "neutral", step: 0, on: "surface", target: bodyText },
    {
      token: "muted",
      ramp: "neutral",
      on: "surface",
      target: bodyText,
      from: "end",
    },
  ],
};

describe("auditTokenSet", () => {
  it("clears a clean spec and hands back the built set", () => {
    const audit = auditTokenSet(CLEAN);
    expect(audit.passes).toBe(true);
    expect(audit.problems).toEqual([]);
    for (const a of [...audit.light, ...audit.dark])
      expect(a.outcome.kind).toBe("clears");
    expect(audit.set).toEqual(buildTokenSet(CLEAN));
    expect(audit.light.map((a) => a.token)).toEqual([
      "surface",
      "ink",
      "muted",
    ]);
  });

  it("reports a picked pairing that fails, with the check, and keeps walking", () => {
    const spec: TokenSetSpec = {
      ...CLEAN,
      light: [
        { token: "surface", ramp: "neutral", step: 0 },
        {
          token: "ink",
          ramp: "neutral",
          step: 2,
          on: "surface",
          target: bodyText,
        },
        {
          token: "on-ink",
          ramp: "neutral",
          step: 0,
          on: "ink",
          target: interfaceElement,
        },
      ],
    };
    const audit = auditTokenSet(spec);
    expect(audit.passes).toBe(false);
    expect(audit.set).toBeNull();
    const ink = audit.light[1]!.outcome;
    expect(ink.kind).toBe("fails");
    if (ink.kind !== "fails") throw new Error("unreachable");
    expect(ink.on).toBe("surface");
    expect(ink.target).toEqual(bodyText);
    expect(ink.check.passes).toBe(false);
    expect(ink.check.wcag.value).toBeLessThan(4.5);
    expect(ink.resolved.receipt).toBeNull();
    expect(ink.resolved.step).toBe(2);
    // The failing ink still has a color, so what sits on it gets its own verdict.
    expect(audit.light[2]!.outcome.kind).toBe("fails");
    expect(() => buildTokenSet(spec)).toThrow(/does not clear/);
  });

  it("marks a solve no step clears as unresolved, and everything on it follows", () => {
    const spec: TokenSetSpec = {
      ...CLEAN,
      light: [
        { token: "surface", ramp: "neutral", step: 3 },
        {
          token: "ink",
          ramp: "neutral",
          on: "surface",
          target: { wcag: 21, apca: 106 },
        },
        {
          token: "on-ink",
          ramp: "neutral",
          step: 0,
          on: "ink",
          target: interfaceElement,
        },
      ],
    };
    const audit = auditTokenSet(spec);
    const ink = audit.light[1]!.outcome;
    expect(ink.kind).toBe("unresolved");
    if (ink.kind !== "unresolved") throw new Error("unreachable");
    expect(ink.reason).toMatch(/cannot be solved on "surface"/);
    const onInk = audit.light[2]!.outcome;
    expect(onInk.kind).toBe("unresolved");
    if (onInk.kind !== "unresolved") throw new Error("unreachable");
    expect(onInk.reason).toMatch(/sits on "ink", which is not bound yet/);
    expect(audit.passes).toBe(false);
  });

  it("marks a step outside the ramp and an unknown ramp as unresolved, by name", () => {
    const audit = auditTokenSet({
      ...CLEAN,
      light: [
        { token: "surface", ramp: "neutral", step: 9 },
        { token: "ink", ramp: "blue", step: 0 },
      ],
    });
    expect(audit.light[0]!.outcome).toEqual({
      kind: "unresolved",
      reason: expect.stringMatching(
        /picks step 9 of ramp "neutral", which has steps 0 to 6/,
      ),
    });
    expect(audit.light[1]!.outcome).toEqual({
      kind: "unresolved",
      reason: expect.stringMatching(/names ramp "blue"/),
    });
  });

  it("names a token bound in one scheme only, and an empty scheme, as problems", () => {
    const audit = auditTokenSet({
      ...CLEAN,
      light: [...CLEAN.light, { token: "extra", ramp: "neutral", step: 1 }],
      dark: [],
    });
    expect(audit.passes).toBe(false);
    expect(audit.problems).toEqual([
      "the dark scheme has no bindings; light and dark are one set",
      '"surface" has no dark binding',
      '"ink" has no dark binding',
      '"muted" has no dark binding',
      '"extra" has no dark binding',
    ]);
  });

  it("refuses only a missing gamut", () => {
    // @ts-expect-error the contract under test
    expect(() => auditTokenSet({ ...CLEAN, gamut: "rec2020" })).toThrow(
      /^auditTokenSet: gamut is rec2020/,
    );
  });
});
