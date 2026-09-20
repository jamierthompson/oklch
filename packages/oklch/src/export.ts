/**
 * Tier 3: what a token set ships as. Full precision everywhere; the
 * sRGB-mapped literal is the base and the P3 literal sits under
 * `@media (color-gamut: p3)`, because browsers clip rather than map.
 */

import { formatHex, formatOklch, type OkLCH } from "./tier1.js";
import type {
  Receipt,
  ResolvedToken,
  Scheme,
  TokenPair,
  TokenSet,
} from "./binding.js";

export interface DeclarationsOptions {
  /** The rule the variables are declared on. Default `:root`. */
  readonly selector?: string;
  /** Prepended to every variable name after the `--`. Default none. */
  readonly prefix?: string;
}

type Pick = (t: ResolvedToken) => OkLCH;

/** A token's `light-dark()` value, from whichever color of each scheme `pick` chooses. */
function lightDark(pair: TokenPair, pick: Pick): string {
  return `light-dark(${formatOklch(pick(pair.light))}, ${formatOklch(pick(pair.dark))})`;
}

/** Tokens whose P3 color differs from what sRGB screens get, in either scheme. */
function p3Overrides(set: TokenSet): TokenPair[] {
  return set.gamut === "p3"
    ? set.tokens.filter((t) => t.light.fallback.moved || t.dark.fallback.moved)
    : [];
}

function block(selector: string, lines: string[], indent = ""): string {
  return `${indent}${selector} {\n${lines.map((l) => `${indent}  ${l}`).join("\n")}\n${indent}}`;
}

const fallback: Pick = (t) => t.fallback.color;
const shipped: Pick = (t) => t.color;

function variables(set: TokenSet, name: (t: TokenPair) => string): string[] {
  return set.tokens.map((t) => `${name(t)}: ${lightDark(t, fallback)};`);
}

function p3Block(
  set: TokenSet,
  selector: string,
  name: (t: TokenPair) => string,
): string {
  const overrides = p3Overrides(set);
  if (overrides.length === 0) return "";
  const lines = overrides.map((t) => `${name(t)}: ${lightDark(t, shipped)};`);
  return `\n\n@media (color-gamut: p3) {\n${block(selector, lines, "  ")}\n}`;
}

/** `light-dark()` resolves against `color-scheme`; without this line it is inert. */
const COLOR_SCHEME = "color-scheme: light dark;";

/**
 * What does this ship as, in plain CSS?
 *
 * `color-scheme: light dark` and one custom property per token on
 * `selector`, each a `light-dark()` of the two schemes' sRGB fallbacks at
 * full precision. When the set was built for P3, every token whose P3 color
 * differs from its fallback in either scheme is redeclared under
 * `@media (color-gamut: p3)`. A set built for sRGB emits no media block:
 * there is nothing to override.
 */
export function tokenSetToDeclarations(
  set: TokenSet,
  options: DeclarationsOptions = {},
): string {
  const selector = options.selector ?? ":root";
  const name = (t: TokenPair): string => `--${options.prefix ?? ""}${t.token}`;
  return (
    block(selector, [COLOR_SCHEME, ...variables(set, name)]) +
    p3Block(set, selector, name) +
    "\n"
  );
}

/**
 * What does this ship as, for Tailwind v4?
 *
 * `--color-<token>` variables in `@theme`, so `bg-<token>` and `text-<token>`
 * utilities exist, each a `light-dark()` value. `color-scheme` cannot live
 * in `@theme`, so it is declared on `:root` alongside, which is also where
 * Tailwind emits theme variables and where the P3 override redeclares them
 * under the media query.
 */
export function tokenSetToTailwindTheme(set: TokenSet): string {
  const name = (t: TokenPair): string => `--color-${t.token}`;
  return (
    block("@theme", variables(set, name)) +
    "\n\n" +
    block(":root", [COLOR_SCHEME]) +
    p3Block(set, ":root", name) +
    "\n"
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
      readonly scheme: Scheme;
      readonly ramp: string;
      readonly step: number;
      readonly how: ResolvedToken["how"];
      /** The sRGB fallback, as OkLCH components. */
      readonly fallback: readonly [number, number, number];
      readonly receipt: Receipt | null;
    };
  };
}

/** One group per scheme, because the format has no notion of a mode. */
export interface DesignTokens {
  readonly light: { readonly [token: string]: DesignToken };
  readonly dark: { readonly [token: string]: DesignToken };
}

const components = (c: OkLCH): readonly [number, number, number] => [
  c.L,
  c.C,
  c.H,
];

function designToken(
  set: TokenSet,
  scheme: Scheme,
  t: ResolvedToken,
): DesignToken {
  return {
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
        scheme,
        ramp: t.ramp,
        step: t.step,
        how: t.how,
        fallback: components(t.fallback.color),
        receipt: t.receipt,
      },
    },
  };
}

/**
 * What does this ship as, for a token pipeline?
 *
 * DTCG 2025.10, with a `light` and a `dark` group because the format has no
 * mode of its own: in each, one `color` token per binding, `$value` in
 * OkLCH at full precision holding the color that ships in the set's gamut,
 * with the format's `hex` slot carrying the sRGB fallback as the
 * specification intends. The fallback's exact components, the ramp step,
 * and the receipt travel in `$extensions` under this package's
 * reverse-domain key.
 */
export function tokenSetToDesignTokens(set: TokenSet): DesignTokens {
  const group = (scheme: Scheme): DesignTokens[Scheme] =>
    Object.fromEntries(
      set.tokens.map((t) => [t.token, designToken(set, scheme, t[scheme])]),
    );
  return { light: group("light"), dark: group("dark") };
}
