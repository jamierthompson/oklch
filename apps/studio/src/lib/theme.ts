/**
 * A theme: two seeds and a harmony, the ramps drafted from them and then
 * moved by eye, which ramp plays which shadcn role, and the steps moved
 * off the preset. Everything derived — bindings, audit, exports — is a
 * pure function of this document.
 */

import {
  auditTokenSet,
  createRamp,
  formatOklch,
  HARMONY_KINDS,
  parseColor,
  SHADCN_CHART_STEPS,
  SHADCN_TOKENS,
  shadcnBindings,
  TAILWIND_STOPS,
  type AuditOutcome,
  type Binding,
  type Gamut,
  type HarmonyKind,
  type OkLCH,
  type Ramp,
  type RampEnd,
  type ShadcnAssignment,
  type TokenSetAudit,
  type TokenSetSpec,
} from "@jamiethompson/oklch";

export type Scheme = "light" | "dark";
export type { HarmonyKind };

/**
 * The roles a ramp can play, in the order they are offered. A role is the
 * only way a ramp gets into the palette: a token's ramp is its role's, and
 * the eye moves steps, not ramps.
 */
export const ROLES = [
  "neutral",
  "primary",
  "destructive",
  "secondary",
  "accent",
  "sidebar",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;
export type Role = (typeof ROLES)[number];

/** The eye's choice of ramp for a role. A role left out plays on its default, which depends on the ramps the theme has. */
export type Assignment = { readonly [R in Role]?: string };

/** One ramp as it stands: drafted from the seeds, then moved by eye. */
export interface ThemeRamp {
  readonly name: string;
  readonly steps: readonly OkLCH[];
  /** The step placed on the seed, for a ramp drawn through one. */
  readonly seed: number | null;
}

/** The eye's replacement for one token's preset step, on the ramp its role plays. Surface and target stay the preset's. */
export type Override =
  { readonly step: number } | { readonly solve: true; readonly from: RampEnd };

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly gamut: Gamut;
  readonly radius: string;
  /** The primary seed color. Its hue tints the neutral and seeds the harmonies. */
  readonly primary: OkLCH;
  /** A second seed color, or none. */
  readonly secondary: OkLCH | null;
  /** Which hues of the primary's are drawn as ramps of their own. */
  readonly harmony: HarmonyKind;
  readonly ramps: readonly ThemeRamp[];
  readonly assignment: Assignment;
  readonly overrides: {
    readonly light: { readonly [token: string]: Override };
    readonly dark: { readonly [token: string]: Override };
  };
}

/** Tailwind's slate sits near this share of the chroma its gamut allows. */
export const NEUTRAL_TINT = 0.15;
export const DESTRUCTIVE_HUE = 25;
/** Below this chroma a color has no hue worth building on. */
export const ACHROMATIC = 0.03;

/** Each harmony by name, with what it is for. Offsets live in `HARMONY_KINDS`. */
export const HARMONY_LABELS: Record<
  HarmonyKind,
  { readonly name: string; readonly description: string }
> = {
  analogous: {
    name: "Analogous",
    description:
      "The neighbors on the wheel. One family of hue: calm, and the accents stay close to the theme.",
  },
  complementary: {
    name: "Complementary",
    description:
      "The opposite hue. The strongest contrast the wheel has, for one accent that has to stand apart.",
  },
  "split-complementary": {
    name: "Split-complementary",
    description:
      "The opposite hue's neighbors. Contrast without the tension of a direct opposite.",
  },
  triadic: {
    name: "Triadic",
    description:
      "Three hues at even thirds. Balanced and vivid; the chart series get the most from it.",
  },
  tetradic: {
    name: "Tetradic",
    description:
      "Four hues at even quarters. The richest set, and the hardest to keep from competing.",
  },
};

export function isChromatic(c: OkLCH): boolean {
  return c.C >= ACHROMATIC;
}

/** The hue the neutral tint and the harmonies are built on: the primary's, else the secondary's, else none. */
export function hueSourceOf(
  primary: OkLCH,
  secondary: OkLCH | null,
): OkLCH | null {
  if (isChromatic(primary)) return primary;
  if (secondary !== null && isChromatic(secondary)) return secondary;
  return null;
}

/** The name of the nth harmony ramp, counting from 1. */
export const harmonyName = (n: number): string => `harmony-${n}`;

/**
 * Every ramp the seeds draft, in display order: the primary through its
 * seed, the secondary through its seed when there is one, the tinted
 * neutral, a red, and one ramp per harmony offset. Throws when a seed sits
 * beyond the gamut's safe chroma at its lightness.
 */
export function draftRamps(
  theme: Pick<Theme, "primary" | "secondary" | "harmony" | "gamut">,
): ThemeRamp[] {
  const { gamut } = theme;
  const source = hueSourceOf(theme.primary, theme.secondary);
  const through = (name: string, color: OkLCH): ThemeRamp => {
    const r = createRamp({
      through: color,
      lightness: TAILWIND_STOPS.chromatic,
      gamut,
    });
    return { name, steps: r.steps, seed: r.through?.index ?? null };
  };
  const at = (name: string, hue: number, saturation: number): ThemeRamp => ({
    name,
    steps: createRamp({
      hue,
      saturation,
      lightness: TAILWIND_STOPS.chromatic,
      gamut,
    }).steps,
    seed: null,
  });
  const primary = through("primary", theme.primary);
  const secondary =
    theme.secondary === null ? [] : [through("secondary", theme.secondary)];
  const neutral: ThemeRamp = {
    name: "neutral",
    steps: createRamp({
      hue: source?.H ?? 0,
      saturation: source === null ? 0 : NEUTRAL_TINT,
      lightness: TAILWIND_STOPS.neutral,
      gamut,
    }).steps,
    seed: null,
  };
  const red = at("red", DESTRUCTIVE_HUE, 0.85);
  // The harmonies keep the source's share of the gamut, so they read as one family.
  const share =
    source === null ? 0 : createRamp({ through: source, gamut }).saturation;
  const harmonies =
    source === null
      ? []
      : HARMONY_KINDS[theme.harmony].map((offset, i) =>
          at(harmonyName(i + 1), source.H + offset, share),
        );
  return [primary, ...secondary, neutral, red, ...harmonies];
}

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * A theme from one color. Throws when the seed is not a color, or sits
 * beyond the gamut's safe chroma at its lightness.
 */
export function newTheme(name: string, seed: string, gamut: Gamut): Theme {
  const primary = parseColor(seed);
  if (primary === null) {
    throw new Error(`"${seed}" is not a color this package reads`);
  }
  const seeds = {
    primary,
    secondary: null,
    harmony: "analogous",
    gamut,
  } as const;
  return {
    id: newId(),
    name,
    radius: "0.625rem",
    ...seeds,
    ramps: draftRamps(seeds),
    assignment: {},
    overrides: { light: {}, dark: {} },
  };
}

export function rampsOf(theme: Theme): Ramp[] {
  return theme.ramps.map((r) => ({ name: r.name, steps: r.steps }));
}

export function hasRamp(theme: Theme, name: string): boolean {
  return theme.ramps.some((r) => r.name === name);
}

/** The ramp a role plays when the eye has not chosen: what the seeds give it. */
export function defaultRampOf(theme: Theme, role: Role): string {
  const has = (name: string) => hasRamp(theme, name);
  switch (role) {
    case "neutral":
    case "sidebar":
      return "neutral";
    case "primary":
    case "ring":
      return "primary";
    case "destructive":
      return "red";
    case "secondary":
      return has("secondary") ? "secondary" : "neutral";
    case "accent":
      return has(harmonyName(1)) ? harmonyName(1) : "neutral";
    default: {
      // The chart series walk the chromatic ramps in order, then repeat the primary.
      const series = [
        "primary",
        "secondary",
        harmonyName(1),
        harmonyName(2),
        harmonyName(3),
      ].filter(has);
      return series[Number(role.slice("chart-".length)) - 1] ?? "primary";
    }
  }
}

/** Which ramp plays this role: the one the eye chose, if the theme still has it, else the default. */
export function rampOf(theme: Theme, role: Role): string {
  const assigned = theme.assignment[role];
  return assigned !== undefined && hasRamp(theme, assigned)
    ? assigned
    : defaultRampOf(theme, role);
}

/** Every role this ramp plays, in `ROLES` order. */
export function rolesOf(theme: Theme, ramp: string): Role[] {
  return ROLES.filter((role) => rampOf(theme, role) === ramp);
}

/** Give a ramp a role. Throws by name on a ramp the theme does not have. */
export function withRole(theme: Theme, role: Role, ramp: string): Theme {
  if (!hasRamp(theme, ramp)) {
    throw new Error(`no ramp named "${ramp}" to play ${role}`);
  }
  return { ...theme, assignment: { ...theme.assignment, [role]: ramp } };
}

/** The theme's roles as the preset takes them: a ramp per role, and the chart series on their ramps at the preset's steps. */
export function assignmentOf(theme: Theme): ShadcnAssignment {
  const series = (scheme: Scheme) => {
    const [s1, s2, s3, s4, s5] = SHADCN_CHART_STEPS[scheme];
    const at = (i: 1 | 2 | 3 | 4 | 5, step: number) => ({
      ramp: rampOf(theme, `chart-${i}`),
      step,
    });
    return [at(1, s1), at(2, s2), at(3, s3), at(4, s4), at(5, s5)] as const;
  };
  return {
    neutral: rampOf(theme, "neutral"),
    primary: rampOf(theme, "primary"),
    destructive: rampOf(theme, "destructive"),
    secondary: rampOf(theme, "secondary"),
    accent: rampOf(theme, "accent"),
    sidebar: rampOf(theme, "sidebar"),
    ring: rampOf(theme, "ring"),
    charts: { light: series("light"), dark: series("dark") },
  };
}

/** The preset's bindings with the eye's overrides applied: each on the ramp its role plays. */
export function bindingsOf(theme: Theme): {
  light: Binding[];
  dark: Binding[];
} {
  const preset = shadcnBindings(assignmentOf(theme), rampsOf(theme));
  const apply = (scheme: Scheme): Binding[] =>
    preset[scheme].map((b) => {
      const o = theme.overrides[scheme][b.token];
      if (o === undefined) return b;
      const pairing =
        b.on === undefined || b.target === undefined
          ? {}
          : { on: b.on, target: b.target };
      return "solve" in o
        ? { token: b.token, ramp: b.ramp, ...pairing, from: o.from }
        : { token: b.token, ramp: b.ramp, step: o.step, ...pairing };
    });
  return { light: apply("light"), dark: apply("dark") };
}

export function specOf(theme: Theme): TokenSetSpec {
  return { ramps: rampsOf(theme), gamut: theme.gamut, ...bindingsOf(theme) };
}

export function auditOf(theme: Theme): TokenSetAudit {
  return auditTokenSet(specOf(theme));
}

/** The color a verdict has, if any. */
export function colorOf(outcome: AuditOutcome): OkLCH | null {
  return outcome.kind === "unresolved" ? null : outcome.resolved.color;
}

/**
 * What a preview wrapper sets inline: every token that has a color, as its
 * shadcn variable, so real components render the palette as it stands —
 * failing pairings included, since that is what the eye is here to see.
 */
export function cssVarsOf(
  audit: TokenSetAudit,
  scheme: Scheme,
  radius: string,
): Record<string, string> {
  const vars: Record<string, string> = { "--radius": radius };
  for (const a of audit[scheme]) {
    const c = colorOf(a.outcome);
    if (c !== null) vars[`--${a.token}`] = formatOklch(c);
  }
  return vars;
}

/**
 * The step the preset's solve would land on for this token, as a pick the
 * eye now owns. Null when no step clears.
 */
export function snapTo(
  theme: Theme,
  scheme: Scheme,
  token: string,
): Override | null {
  const from = fromOf(theme, scheme, token);
  const solved = withOverride(theme, scheme, token, { solve: true, from });
  const outcome = auditOf(solved)[scheme].find(
    (a) => a.token === token,
  )?.outcome;
  return outcome === undefined || outcome.kind === "unresolved"
    ? null
    : { step: outcome.resolved.step };
}

/** Which end a solve walks from for this token: the override's, else the preset's, else the start. */
export function fromOf(theme: Theme, scheme: Scheme, token: string): RampEnd {
  const o = theme.overrides[scheme][token];
  if (o !== undefined && "solve" in o) return o.from;
  const preset = shadcnBindings(assignmentOf(theme), rampsOf(theme))[
    scheme
  ].find((b) => b.token === token);
  return preset?.from ?? "start";
}

export function withOverride(
  theme: Theme,
  scheme: Scheme,
  token: string,
  override: Override | null,
): Theme {
  const next = { ...theme.overrides[scheme] };
  if (override === null) delete next[token];
  else next[token] = override;
  return { ...theme, overrides: { ...theme.overrides, [scheme]: next } };
}

export function withStep(
  theme: Theme,
  rampName: string,
  index: number,
  step: OkLCH,
): Theme {
  return {
    ...theme,
    ramps: theme.ramps.map((r) =>
      r.name === rampName
        ? { ...r, steps: r.steps.map((s, i) => (i === index ? step : s)) }
        : r,
    ),
  };
}

/**
 * Redraft the ramps from the seeds, keeping the steps of every ramp in
 * `keep` that the seeds still draw, so what the eye moved on a ramp the
 * change did not touch stays moved.
 */
function redrawn(theme: Theme, keep: readonly string[]): Theme {
  const kept = new Map(
    theme.ramps.filter((r) => keep.includes(r.name)).map((r) => [r.name, r]),
  );
  return {
    ...theme,
    ramps: draftRamps(theme).map((r) => kept.get(r.name) ?? r),
  };
}

/** A new primary seed: the primary, the neutral tint, and the harmonies redraw; the secondary and the red keep the eye's steps. */
export function withPrimary(theme: Theme, primary: OkLCH): Theme {
  return redrawn({ ...theme, primary }, ["secondary", "red"]);
}

/**
 * A new secondary seed, or none. The secondary redraws; everything built
 * on the hue source redraws too when that source is or was the secondary.
 */
export function withSecondary(theme: Theme, secondary: OkLCH | null): Theme {
  const next = { ...theme, secondary };
  const sourceIsPrimary =
    hueSourceOf(theme.primary, theme.secondary) === theme.primary &&
    hueSourceOf(next.primary, next.secondary) === next.primary;
  return redrawn(
    next,
    sourceIsPrimary
      ? theme.ramps.map((r) => r.name).filter((n) => n !== "secondary")
      : ["primary", "red"],
  );
}

/** Another harmony: only the harmony ramps redraw. */
export function withHarmony(theme: Theme, harmony: HarmonyKind): Theme {
  return redrawn(
    { ...theme, harmony },
    theme.ramps.map((r) => r.name).filter((n) => !n.startsWith("harmony-")),
  );
}

export function withGamut(theme: Theme, gamut: Gamut): Theme {
  return { ...theme, gamut };
}

export function serialize(theme: Theme): string {
  return JSON.stringify(theme, null, 2);
}

function isColor(v: unknown): v is OkLCH {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (["L", "C", "H"] as const).every(
    (ch) => typeof c[ch] === "number" && Number.isFinite(c[ch]),
  );
}

/** Reads a theme back, naming what is wrong with it. */
export function parse(text: string): Theme {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== "object" || raw === null) throw new Error("not an object");
  const b = raw as Record<string, unknown>;
  for (const key of ["id", "name", "radius"] as const) {
    if (typeof b[key] !== "string") throw new Error(`${key} is not a string`);
  }
  if (b["gamut"] !== "srgb" && b["gamut"] !== "p3") {
    throw new Error(`gamut ${String(b["gamut"])} is not "srgb" or "p3"`);
  }
  if (!isColor(b["primary"])) throw new Error("primary is not a color");
  if (b["secondary"] !== null && !isColor(b["secondary"])) {
    throw new Error("secondary is not a color or null");
  }
  if (!Object.hasOwn(HARMONY_KINDS, String(b["harmony"]))) {
    throw new Error(
      `harmony ${String(b["harmony"])} is not one of ${Object.keys(HARMONY_KINDS).join(", ")}`,
    );
  }
  if (!Array.isArray(b["ramps"]) || b["ramps"].length === 0) {
    throw new Error("ramps is not a non-empty list");
  }
  for (const r of b["ramps"] as unknown[]) {
    const ramp = r as Record<string, unknown>;
    if (typeof ramp["name"] !== "string") throw new Error("a ramp has no name");
    if (!Array.isArray(ramp["steps"])) {
      throw new Error(`ramp "${ramp["name"]}" has no steps`);
    }
    for (const s of ramp["steps"] as unknown[]) {
      if (!isColor(s)) {
        throw new Error(
          `ramp "${ramp["name"]}" has a step that is not a color`,
        );
      }
    }
    if (ramp["seed"] !== null && !Number.isInteger(ramp["seed"])) {
      throw new Error(
        `ramp "${ramp["name"]}" has a seed step that is not an index`,
      );
    }
  }
  const theme = b as unknown as Theme;
  const names = new Set(theme.ramps.map((r) => r.name));
  if (typeof theme.assignment !== "object" || theme.assignment === null) {
    throw new Error("assignment is not an object");
  }
  for (const [role, v] of Object.entries(theme.assignment)) {
    if (!(ROLES as readonly string[]).includes(role)) {
      throw new Error(`"${role}" is not a role`);
    }
    if (!names.has(v as string)) {
      throw new Error(
        `${role} names ramp "${String(v)}", which the theme does not have`,
      );
    }
  }
  for (const s of ["light", "dark"] as const) {
    for (const [t, o] of Object.entries(theme.overrides?.[s] ?? {})) {
      if (!(SHADCN_TOKENS as readonly string[]).includes(t)) {
        throw new Error(`${s} override "${t}" is not a shadcn token`);
      }
      const isStep = "step" in o && Number.isInteger(o.step) && !("solve" in o);
      const isSolve =
        "solve" in o &&
        o.solve === true &&
        (o.from === "start" || o.from === "end");
      if (!isStep && !isSolve) {
        throw new Error(
          `${s} override "${t}" is neither a step nor a solve from "start" or "end"`,
        );
      }
    }
  }
  return theme;
}
