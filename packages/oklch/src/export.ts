/**
 * Tier 3: what a token set ships as. Full precision everywhere; the
 * sRGB-mapped literal is the base and the P3 literal sits under
 * `@media (color-gamut: p3)`, because browsers clip rather than map.
 */

import { formatHex, formatOklch, type OkLCH } from "./tier1.js";
import type { Receipt, ResolvedToken, TokenSet } from "./binding.js";

export interface DeclarationsOptions {
  /** The rule the variables are declared on. Default `:root`. */
  readonly selector?: string;
  /** Prepended to every variable name after the `--`. Default none. */
  readonly prefix?: string;
}

/** Tokens whose P3 color differs from what sRGB screens get. */
function p3Overrides(set: TokenSet): ResolvedToken[] {
  return set.gamut === "p3" ? set.tokens.filter((t) => t.fallback.moved) : [];
}

function block(selector: string, lines: string[], indent = ""): string {
  return `${indent}${selector} {\n${lines.map((l) => `${indent}  ${l}`).join("\n")}\n${indent}}`;
}

function variables(
  set: TokenSet,
  name: (t: ResolvedToken) => string,
): string[] {
  return set.tokens.map((t) => `${name(t)}: ${formatOklch(t.fallback.color)};`);
}

function p3Block(
  set: TokenSet,
  selector: string,
  name: (t: ResolvedToken) => string,
): string {
  const overrides = p3Overrides(set);
  if (overrides.length === 0) return "";
  const lines = overrides.map((t) => `${name(t)}: ${formatOklch(t.color)};`);
  return `\n\n@media (color-gamut: p3) {\n${block(selector, lines, "  ")}\n}`;
}

/**
 * What does this ship as, in plain CSS?
 *
 * One custom property per token on `selector`, holding the sRGB fallback at
 * full precision. When the set was built for P3, every token whose P3 color
 * differs from its fallback is redeclared under `@media (color-gamut: p3)`.
 * A set built for sRGB emits no media block: there is nothing to override.
 */
export function tokenSetToDeclarations(
  set: TokenSet,
  options: DeclarationsOptions = {},
): string {
  const selector = options.selector ?? ":root";
  const name = (t: ResolvedToken): string =>
    `--${options.prefix ?? ""}${t.token}`;
  return (
    block(selector, variables(set, name)) + p3Block(set, selector, name) + "\n"
  );
}

/**
 * What does this ship as, for Tailwind v4?
 *
 * `--color-<token>` variables in `@theme`, so `bg-<token>` and `text-<token>`
 * utilities exist. Tailwind emits theme variables on `:root`, so the P3
 * override redeclares them there under the media query, where the
 * utilities' `var()` references pick them up.
 */
export function tokenSetToTailwindTheme(set: TokenSet): string {
  const name = (t: ResolvedToken): string => `--color-${t.token}`;
  return (
    block("@theme", variables(set, name)) + p3Block(set, ":root", name) + "\n"
  );
}

/** A DTCG 2025.10 color value. `hex` is the format's own sRGB fallback slot. */
export interface DesignTokenColor {
  readonly colorSpace: "oklch";
  readonly components: readonly [number, number, number];
  readonly alpha: 1;
  readonly hex: string;
}

export interface DesignToken {
  readonly $type: "color";
  readonly $value: DesignTokenColor;
  readonly $description?: string;
  readonly $extensions: {
    readonly "com.jamiethompson.oklch": {
      readonly gamut: TokenSet["gamut"];
      readonly ramp: string;
      readonly step: number;
      readonly how: ResolvedToken["how"];
      /** The sRGB fallback, as OkLCH components. */
      readonly fallback: readonly [number, number, number];
      readonly receipt: Receipt | null;
    };
  };
}

export interface DesignTokens {
  readonly [token: string]: DesignToken;
}

const components = (c: OkLCH): readonly [number, number, number] => [
  c.L,
  c.C,
  c.H,
];

/**
 * What does this ship as, for a token pipeline?
 *
 * DTCG 2025.10: one `color` token per binding, `$value` in OkLCH at full
 * precision holding the color that ships in the set's gamut, with the
 * format's `hex` slot carrying the sRGB fallback as the specification
 * intends. The fallback's exact components, the ramp step, and the receipt
 * travel in `$extensions` under this package's reverse-domain key.
 */
export function tokenSetToDesignTokens(set: TokenSet): DesignTokens {
  return Object.fromEntries(
    set.tokens.map((t) => [
      t.token,
      {
        $type: "color",
        $value: {
          colorSpace: "oklch",
          components: components(t.color),
          alpha: 1,
          hex: formatHex(t.fallback.color).hex,
        },
        ...(t.receipt === null
          ? {}
          : {
              $description: `On ${t.receipt.on}: ${t.receipt.wcag.standard} ${t.receipt.wcag.value.toFixed(2)} (≥ ${t.receipt.target.wcag}); ${t.receipt.apca.standard} ${t.receipt.apca.value.toFixed(1)} (≥ ${t.receipt.target.apca}).`,
            }),
        $extensions: {
          "com.jamiethompson.oklch": {
            gamut: set.gamut,
            ramp: t.ramp,
            step: t.step,
            how: t.how,
            fallback: components(t.fallback.color),
            receipt: t.receipt,
          },
        },
      } satisfies DesignToken,
    ]),
  );
}
