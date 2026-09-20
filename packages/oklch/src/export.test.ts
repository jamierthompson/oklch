import { describe, expect, it } from "vitest";

import { CONTRAST_TARGETS, formatOklch, parseColor } from "./tier1.js";
import { buildTokenSet, type TokenSetSpec } from "./binding.js";
import {
  tokenSetToDeclarations,
  tokenSetToDesignTokens,
  tokenSetToTailwindTheme,
} from "./export.js";

// A float artifact, so full precision is visible in the output.
const NEUTRAL_C = 0.1 + 0.2 - 0.296;

const SPEC: TokenSetSpec = {
  ramps: [
    {
      name: "neutral",
      steps: [0.98, 0.6, 0.2].map((L) => ({ L, C: NEUTRAL_C, H: 260 })),
    },
    { name: "red", steps: [{ L: 0.62, C: 0.26, H: 30 }] },
  ],
  gamut: "p3",
  bindings: [
    { token: "surface", ramp: "neutral", step: 0 },
    {
      token: "ink",
      ramp: "neutral",
      on: "surface",
      target: CONTRAST_TARGETS.bodyText,
    },
    { token: "accent", ramp: "red", step: 0 },
  ],
};
const P3 = buildTokenSet(SPEC);
const SRGB = buildTokenSet({ ...SPEC, gamut: "srgb" });

describe("tokenSetToDeclarations", () => {
  it("declares the sRGB fallback on :root and the P3 literal under the media query", () => {
    const css = tokenSetToDeclarations(P3);
    const accent = P3.tokens.find((t) => t.token === "accent")!;
    expect(css).toContain(
      `:root {\n  --surface: ${formatOklch(P3.tokens[0]!.fallback.color)};`,
    );
    expect(css).toContain(`--accent: ${formatOklch(accent.fallback.color)};`);
    expect(css).toContain(
      `@media (color-gamut: p3) {\n  :root {\n    --accent: ${formatOklch(accent.color)};\n  }\n}`,
    );
    // Tokens that fit sRGB are not redeclared.
    expect(css.split("--surface").length - 1).toBe(1);
  });

  it("emits no media block for a set built for sRGB", () => {
    expect(tokenSetToDeclarations(SRGB)).not.toContain("@media");
  });

  it("emits full precision: the declaration parses back to the exact color", () => {
    const css = tokenSetToDeclarations(SRGB);
    const value = /--surface: (oklch\([^)]+\));/.exec(css)![1]!;
    expect(parseColor(value)).toEqual(SRGB.tokens[0]!.fallback.color);
    expect(value).toContain(String(NEUTRAL_C));
  });

  it("takes a selector and a prefix", () => {
    const css = tokenSetToDeclarations(SRGB, {
      selector: ".theme",
      prefix: "c-",
    });
    expect(css.startsWith(".theme {\n  --c-surface:")).toBe(true);
  });
});

describe("tokenSetToTailwindTheme", () => {
  it("declares --color-* in @theme and overrides on :root for P3", () => {
    const css = tokenSetToTailwindTheme(P3);
    expect(css.startsWith("@theme {\n  --color-surface:")).toBe(true);
    expect(css).toContain(
      "@media (color-gamut: p3) {\n  :root {\n    --color-accent:",
    );
    expect(tokenSetToTailwindTheme(SRGB)).not.toContain("@media");
  });
});

describe("tokenSetToDesignTokens", () => {
  it("emits DTCG 2025.10 color tokens: OkLCH components at full precision, hex as the sRGB fallback", () => {
    const tokens = tokenSetToDesignTokens(P3);
    const accent = tokens["accent"]!;
    const resolved = P3.tokens.find((t) => t.token === "accent")!;
    expect(accent.$type).toBe("color");
    expect(accent.$value.colorSpace).toBe("oklch");
    expect(accent.$value.components).toEqual([
      resolved.color.L,
      resolved.color.C,
      resolved.color.H,
    ]);
    expect(accent.$value.alpha).toBe(1);
    expect(accent.$value.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(parseColor(accent.$value.hex)!.C).toBeLessThan(resolved.color.C);
  });

  it("carries the fallback, the step, and the receipt in $extensions, and the receipt in $description", () => {
    const tokens = tokenSetToDesignTokens(P3);
    const ink = tokens["ink"]!;
    const ext = ink.$extensions["com.jamiethompson.oklch"];
    expect(ext.gamut).toBe("p3");
    expect(ext.ramp).toBe("neutral");
    expect(ext.how).toBe("solved");
    expect(ext.receipt!.on).toBe("surface");
    expect(ink.$description).toMatch(
      /^On surface: WCAG 2.2 contrast ratio \(conformance\) \d+\.\d\d \(≥ 4.5\); APCA-W3 Lc/,
    );
    expect(tokens["surface"]!.$description).toBeUndefined();
    expect(
      tokens["surface"]!.$extensions["com.jamiethompson.oklch"].receipt,
    ).toBeNull();
  });

  it("is plain JSON", () => {
    expect(() => JSON.stringify(tokenSetToDesignTokens(P3))).not.toThrow();
  });
});
