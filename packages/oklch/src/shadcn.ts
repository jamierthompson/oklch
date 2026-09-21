/**
 * Tier 3: the shadcn/ui token shape. Which ramps play which roles, bound
 * in the order shadcn's variables depend on each other, with the contrast
 * bar each pairing must clear; and what the set ships as, for shadcn.
 */

import { CONTRAST_TARGETS, formatOklch, type OkLCH } from "./tier1.js";
import type {
  Binding,
  Ramp,
  ResolvedToken,
  Scheme,
  TokenSet,
} from "./binding.js";

/**
 * shadcn/ui's base color variables, in dependency order: every surface
 * before the ink that sits on it. Verified against ui.shadcn.com/docs/theming;
 * there is no `destructive-foreground` any more.
 */
export const SHADCN_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

export type ShadcnToken = (typeof SHADCN_TOKENS)[number];

/** A step of a named ramp. */
export interface StepRef {
  readonly ramp: string;
  readonly step: number;
}

/**
 * Which ramp plays which role. Every ramp named must have Tailwind's eleven
 * stops (index 0 is 50, index 10 is 950), light to dark, which is what
 * `createRamp` draws.
 */
export interface ShadcnAssignment {
  /** Surfaces, text, borders: the tinted gray. */
  readonly neutral: string;
  /** Buttons, links, the brand. */
  readonly primary: string;
  /** Errors and destructive actions. Usually a red. */
  readonly destructive: string;
  /** Secondary surfaces. Default: `neutral`. */
  readonly secondary?: string;
  /** Hover and selection surfaces. Default: `neutral`. */
  readonly accent?: string;
  /**
   * The five chart series, per scheme. Default: five steps of `primary`,
   * spread across the ramp.
   */
  readonly charts?: {
    readonly light: readonly [StepRef, StepRef, StepRef, StepRef, StepRef];
    readonly dark: readonly [StepRef, StepRef, StepRef, StepRef, StepRef];
  };
}

export interface ShadcnBindings {
  readonly light: readonly Binding[];
  readonly dark: readonly Binding[];
}

/** The number of steps the preset picks by. */
export const SHADCN_RAMP_STEPS = 11;

const { bodyText, interfaceElement } = CONTRAST_TARGETS;

/**
 * shadcn's variables bound to these ramps, in both schemes.
 *
 * Surfaces, borders, inputs, and chart series are picked steps: the eye's
 * to move. Every `*-foreground` is solved on its surface for body text,
 * walking from the surface's far end, so the default is the strongest
 * legible ink; the inks on `primary` and `muted` walk from the near end
 * instead, so they are the quietest step that still clears. `primary` and
 * `destructive` are picked and must clear the 3:1 non-text bar on
 * `background`, because they are drawn as text and as fills; `primary`
 * sits where shadcn's own does, near-black in light and near-white in
 * dark, so body text on it has room. `ring` is solved on its surface for
 * the same bar, from the near end: the quietest gray that still reads as
 * a focus ring. `border`, `input`, `sidebar-border`, and the chart series
 * carry no target: shadcn's own borders sit below 3:1 by design, and a
 * chart's series contrast with each other, not the page.
 *
 * Nothing here is measured. The bindings go to `auditTokenSet` for a
 * verdict per token, or to `buildTokenSet` for a set or a refusal. Throws
 * by name on an unknown ramp, and on a ramp without eleven steps.
 */
export function shadcnBindings(
  assignment: ShadcnAssignment,
  ramps: readonly Ramp[],
): ShadcnBindings {
  const fn = "shadcnBindings";
  const neutral = assignment.neutral;
  const primary = assignment.primary;
  const destructive = assignment.destructive;
  const secondary = assignment.secondary ?? neutral;
  const accent = assignment.accent ?? neutral;

  for (const [role, name] of Object.entries({
    neutral,
    primary,
    destructive,
    secondary,
    accent,
  })) {
    const ramp = ramps.find((r) => r.name === name);
    if (ramp === undefined) {
      throw new RangeError(
        `${fn}: ${role} names ramp "${name}", which is not one of: ${ramps.map((r) => r.name).join(", ") || "(none)"}`,
      );
    }
    if (ramp.steps.length !== SHADCN_RAMP_STEPS) {
      throw new RangeError(
        `${fn}: ramp "${name}" has ${ramp.steps.length} steps; the preset picks by Tailwind's eleven stops (50 to 950), which is what createRamp draws`,
      );
    }
  }
  const charts = assignment.charts ?? {
    light: [
      { ramp: primary, step: 6 },
      { ramp: primary, step: 4 },
      { ramp: primary, step: 8 },
      { ramp: primary, step: 2 },
      { ramp: primary, step: 10 },
    ],
    dark: [
      { ramp: primary, step: 4 },
      { ramp: primary, step: 6 },
      { ramp: primary, step: 2 },
      { ramp: primary, step: 8 },
      { ramp: primary, step: 0 },
    ],
  };

  const scheme = (s: Scheme): Binding[] => {
    const light = s === "light";
    // The steps each scheme picks, light to dark: 0 is 50, 10 is 950.
    const page = light ? 0 : 10;
    const raised = light ? 0 : 9;
    const subtle = light ? 1 : 8;
    const hairline = light ? 2 : 8;
    const brand = light ? 8 : 2;
    const alert = light ? 6 : 4;
    const far = light ? "end" : "start";
    const near = light ? "start" : "end";

    const surface = (token: string, ramp: string, step: number): Binding => ({
      token,
      ramp,
      step,
    });
    const ink = (
      token: string,
      on: string,
      from: "start" | "end" = far,
    ): Binding => ({ token, ramp: neutral, on, target: bodyText, from });
    const element = (
      token: string,
      ramp: string,
      step: number,
      on: string,
    ): Binding => ({ token, ramp, step, on, target: interfaceElement });
    const focus = (token: string, on: string): Binding => ({
      token,
      ramp: neutral,
      on,
      target: interfaceElement,
      from: near,
    });

    return [
      surface("background", neutral, page),
      ink("foreground", "background"),
      surface("card", neutral, raised),
      ink("card-foreground", "card"),
      surface("popover", neutral, raised),
      ink("popover-foreground", "popover"),
      element("primary", primary, brand, "background"),
      ink("primary-foreground", "primary", near),
      surface("secondary", secondary, subtle),
      ink("secondary-foreground", "secondary"),
      surface("muted", neutral, subtle),
      ink("muted-foreground", "muted", near),
      surface("accent", accent, subtle),
      ink("accent-foreground", "accent"),
      element("destructive", destructive, alert, "background"),
      surface("border", neutral, hairline),
      surface("input", neutral, hairline),
      focus("ring", "background"),
      ...charts[s].map((c, i) => surface(`chart-${i + 1}`, c.ramp, c.step)),
      surface("sidebar", neutral, light ? 1 : 9),
      ink("sidebar-foreground", "sidebar"),
      element("sidebar-primary", primary, brand, "sidebar"),
      ink("sidebar-primary-foreground", "sidebar-primary", near),
      surface("sidebar-accent", accent, light ? 2 : 8),
      ink("sidebar-accent-foreground", "sidebar-accent"),
      surface("sidebar-border", neutral, hairline),
      focus("sidebar-ring", "sidebar"),
    ];
  };

  return { light: scheme("light"), dark: scheme("dark") };
}

export interface ShadcnCssOptions {
  /** Emitted as `--radius` on `:root`, since a pasted block replaces the one holding it. Default none. */
  readonly radius?: string;
}

function declarations(
  set: TokenSet,
  pick: (t: ResolvedToken) => OkLCH,
  scheme: Scheme,
): string[] {
  return set.tokens.map(
    (t) => `--${t.token}: ${formatOklch(pick(t[scheme]))};`,
  );
}

function cssBlock(selector: string, lines: string[], indent = ""): string {
  return `${indent}${selector} {\n${lines.map((l) => `${indent}  ${l}`).join("\n")}\n${indent}}`;
}

/**
 * What does this ship as, for shadcn/ui?
 *
 * The three blocks shadcn's `globals.css` holds: every token on `:root`
 * for light, the same names on `.dark`, and `@theme inline` mapping each
 * to `--color-<token>` so the Tailwind utilities exist. Values are the sRGB
 * fallbacks at full precision. When the set was built for P3, every token
 * whose P3 color differs from its fallback in a scheme is redeclared under
 * `@media (color-gamut: p3)`. The `@custom-variant dark` line and the
 * Tailwind import stay in the file this is pasted into; they are written
 * once by `shadcn init`, not per theme.
 */
export function tokenSetToShadcnCss(
  set: TokenSet,
  options: ShadcnCssOptions = {},
): string {
  const fallback = (t: ResolvedToken): OkLCH => t.fallback.color;
  const shipped = (t: ResolvedToken): OkLCH => t.color;
  const radius =
    options.radius === undefined ? [] : [`--radius: ${options.radius};`];
  const theme = set.tokens.map((t) => `--color-${t.token}: var(--${t.token});`);
  let css =
    cssBlock(":root", [...radius, ...declarations(set, fallback, "light")]) +
    "\n\n" +
    cssBlock(".dark", declarations(set, fallback, "dark")) +
    "\n\n" +
    cssBlock("@theme inline", theme) +
    "\n";
  if (set.gamut === "p3") {
    const p3 = (scheme: Scheme): string[] =>
      set.tokens
        .filter((t) => t[scheme].fallback.moved)
        .map((t) => `--${t.token}: ${formatOklch(shipped(t[scheme]))};`);
    const light = p3("light");
    const dark = p3("dark");
    if (light.length > 0 || dark.length > 0) {
      const blocks = [
        ...(light.length > 0 ? [cssBlock(":root", light, "  ")] : []),
        ...(dark.length > 0 ? [cssBlock(".dark", dark, "  ")] : []),
      ];
      css += `\n@media (color-gamut: p3) {\n${blocks.join("\n\n")}\n}\n`;
    }
  }
  return css;
}

export interface RegistryItemOptions {
  /** The item's name: what `npx shadcn add` installs it as. A kebab-case identifier. */
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
}

/** A shadcn registry item of type `registry:theme`. */
export interface RegistryItem {
  readonly $schema: "https://ui.shadcn.com/schema/registry-item.json";
  readonly name: string;
  readonly type: "registry:theme";
  readonly title?: string;
  readonly description?: string;
  readonly cssVars: {
    readonly light: { readonly [token: string]: string };
    readonly dark: { readonly [token: string]: string };
  };
}

const REGISTRY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * What does this ship as, for a shadcn registry?
 *
 * A `registry:theme` item: one entry per token under `cssVars.light` and
 * `cssVars.dark`, each an `oklch()` of the sRGB fallback at full
 * precision. The format has no slot for a P3 value, so a set built for P3
 * ships its fallbacks here and its P3 overrides only through
 * `tokenSetToShadcnCss`. Installed with `npx shadcn add <url>`. Refuses a
 * name that is not kebab-case, since the registry would.
 */
export function tokenSetToRegistryItem(
  set: TokenSet,
  options: RegistryItemOptions,
): RegistryItem {
  if (!REGISTRY_NAME.test(options.name)) {
    throw new TypeError(
      `tokenSetToRegistryItem: name "${options.name}" is not kebab-case (lowercase letters, digits, single hyphens); the registry refuses anything else`,
    );
  }
  const vars = (scheme: Scheme): { [token: string]: string } =>
    Object.fromEntries(
      set.tokens.map((t) => [t.token, formatOklch(t[scheme].fallback.color)]),
    );
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: options.name,
    type: "registry:theme",
    ...(options.title === undefined ? {} : { title: options.title }),
    ...(options.description === undefined
      ? {}
      : { description: options.description }),
    cssVars: { light: vars("light"), dark: vars("dark") },
  };
}
