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
    {
      name: "red",
      steps: [
        { L: 0.62, C: 0.26, H: 30 },
        { L: 0.7, C: 0.12, H: 30 },
      ],
    },
  ],
  gamut: "p3",
  light: [
    { token: "surface", ramp: "neutral", step: 0 },
    {
      token: "ink",
      ramp: "neutral",
      on: "surface",
      target: CONTRAST_TARGETS.bodyText,
    },
    { token: "accent", ramp: "red", step: 0 },
  ],
  dark: [
    { token: "surface", ramp: "neutral", step: 2 },
    {
      token: "ink",
      ramp: "neutral",
      on: "surface",
      target: CONTRAST_TARGETS.bodyText,
    },
    { token: "accent", ramp: "red", step: 1 },
  ],
};
const P3 = buildTokenSet(SPEC);
const SRGB = buildTokenSet({ ...SPEC, gamut: "srgb" });
const pair = (name: string) => P3.tokens.find((t) => t.token === name)!;

describe("tokenSetToDeclarations", () => {
  it("declares color-scheme and a light-dark() of both fallbacks per token on :root", () => {
    const css = tokenSetToDeclarations(P3);
    const surface = pair("surface");
    expect(
      css.startsWith(
        ":root {\n  color-scheme: light dark;\n  --surface: light-dark(",
      ),
    ).toBe(true);
    expect(css).toContain(
      `--surface: light-dark(${formatOklch(surface.light.fallback.color)}, ${formatOklch(surface.dark.fallback.color)});`,
    );
  });

  it("redeclares only tokens whose P3 color differs, under the media query, still as light-dark()", () => {
    const css = tokenSetToDeclarations(P3);
    const accent = pair("accent");
    expect(accent.light.fallback.moved).toBe(true);
    expect(accent.dark.fallback.moved).toBe(false);
    expect(css).toContain(
      `@media (color-gamut: p3) {\n  :root {\n    --accent: light-dark(${formatOklch(accent.light.color)}, ${formatOklch(accent.dark.color)});\n  }\n}`,
    );
    expect(css.split("--surface").length - 1).toBe(1);
  });

  it("emits no media block for a set built for sRGB", () => {
    expect(tokenSetToDeclarations(SRGB)).not.toContain("@media");
  });

  it("emits full precision: each half parses back to the exact color", () => {
    const css = tokenSetToDeclarations(SRGB);
    const m =
      /--surface: light-dark\((oklch\([^)]+\)), (oklch\([^)]+\))\);/.exec(css)!;
    const surface = SRGB.tokens[0]!;
    expect(parseColor(m[1]!)).toEqual(surface.light.fallback.color);
    expect(parseColor(m[2]!)).toEqual(surface.dark.fallback.color);
    expect(m[1]).toContain(String(NEUTRAL_C));
  });

  it("takes a selector and a prefix", () => {
    const css = tokenSetToDeclarations(SRGB, {
      selector: ".theme",
      prefix: "c-",
    });
    expect(
      css.startsWith(".theme {\n  color-scheme: light dark;\n  --c-surface:"),
    ).toBe(true);
  });
});

describe("tokenSetToTailwindTheme", () => {
  it("declares --color-* light-dark() values in @theme, color-scheme on :root, and P3 overrides on :root", () => {
    const css = tokenSetToTailwindTheme(P3);
    expect(css.startsWith("@theme {\n  --color-surface: light-dark(")).toBe(
      true,
    );
    expect(css).toContain("\n\n:root {\n  color-scheme: light dark;\n}");
    expect(css).toContain(
      "@media (color-gamut: p3) {\n  :root {\n    --color-accent: light-dark(",
    );
    expect(tokenSetToTailwindTheme(SRGB)).not.toContain("@media");
  });
});

describe("tokenSetToDesignTokens", () => {
  it("emits a light and a dark group of DTCG 2025.10 color tokens", () => {
    const tokens = tokenSetToDesignTokens(P3);
    expect(Object.keys(tokens)).toEqual(["light", "dark"]);
    expect(Object.keys(tokens.light)).toEqual(["surface", "ink", "accent"]);
    const accent = tokens.light["accent"]!;
    const resolved = pair("accent").light;
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
    expect(tokens.dark["accent"]!.$value.components[0]).toBe(
      pair("accent").dark.color.L,
    );
  });

  it("carries the scheme, fallback, step, and receipt in $extensions, and the receipt in $description", () => {
    const tokens = tokenSetToDesignTokens(P3);
    const ink = tokens.dark["ink"]!;
    const ext = ink.$extensions["com.jamiethompson.oklch"];
    expect(ext.gamut).toBe("p3");
    expect(ext.scheme).toBe("dark");
    expect(ext.ramp).toBe("neutral");
    expect(ext.how).toBe("solved");
    expect(ext.receipt!.scheme).toBe("dark");
    expect(ink.$description).toMatch(
      /^On surface: WCAG 2.2 contrast ratio \(conformance\) \d+\.\d\d \(≥ 4.5\); APCA-W3 Lc/,
    );
    expect(tokens.light["surface"]!.$description).toBeUndefined();
    expect(
      tokens.light["surface"]!.$extensions["com.jamiethompson.oklch"].receipt,
    ).toBeNull();
  });

  it("is plain JSON", () => {
    expect(() => JSON.stringify(tokenSetToDesignTokens(P3))).not.toThrow();
  });
});
