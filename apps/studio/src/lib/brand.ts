/**
 * A brand: two seeds and a harmony, the ramps drafted from them and then
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

/** The eye's choice of ramp for a role. A role left out plays on its default, which depends on the ramps the brand has. */
export type Assignment = { readonly [R in Role]?: string };

/** One ramp as it stands: drafted from the seeds, then moved by eye. */
export interface BrandRamp {
  readonly name: string;
  readonly steps: readonly OkLCH[];
  /** The step placed on the seed, for a ramp drawn through one. */
  readonly seed: number | null;
}

/** The eye's replacement for one token's preset step, on the ramp its role plays. Surface and target stay the preset's. */
export type Override =
  { readonly step: number } | { readonly solve: true; readonly from: RampEnd };

export interface Brand {
  readonly id: string;
  readonly name: string;
  readonly gamut: Gamut;
  readonly radius: string;
  /** The brand color. Its hue tints the neutral and seeds the harmonies. */
  readonly primary: OkLCH;
  /** A second brand color, or none. */
  readonly secondary: OkLCH | null;
  /** Which hues of the primary's are drawn as ramps of their own. */
  readonly harmony: HarmonyKind;
  readonly ramps: readonly BrandRamp[];
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

export const HARMONY_LABELS: Record<
  HarmonyKind,
  { readonly name: string; readonly short: string }
> = {
  analogous: { name: "Analogous", short: "±30°" },
  complementary: { name: "Complementary", short: "180°" },
  "split-complementary": { name: "Split-complementary", short: "150/210°" },
  triadic: { name: "Triadic", short: "±120°" },
  tetradic: { name: "Tetradic", short: "90°×3" },
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
 * Every ramp the seeds draft, in display order: the tinted neutral, the
 * primary through its seed, the secondary through its seed when there is
 * one, a red, and one ramp per harmony offset. Throws when a seed sits
 * beyond the gamut's safe chroma at its lightness.
 */
export function draftRamps(
  brand: Pick<Brand, "primary" | "secondary" | "harmony" | "gamut">,
): BrandRamp[] {
  const { gamut } = brand;
  const source = hueSourceOf(brand.primary, brand.secondary);
  const through = (name: string, color: OkLCH): BrandRamp => {
    const r = createRamp({
      through: color,
      lightness: TAILWIND_STOPS.chromatic,
      gamut,
    });
    return { name, steps: r.steps, seed: r.through?.index ?? null };
  };
  const at = (name: string, hue: number, saturation: number): BrandRamp => ({
    name,
    steps: createRamp({
      hue,
      saturation,
      lightness: TAILWIND_STOPS.chromatic,
      gamut,
    }).steps,
    seed: null,
  });
  const primary = through("primary", brand.primary);
  const secondary =
    brand.secondary === null ? [] : [through("secondary", brand.secondary)];
  const neutral: BrandRamp = {
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
      : HARMONY_KINDS[brand.harmony].map((offset, i) =>
          at(harmonyName(i + 1), source.H + offset, share),
        );
  return [neutral, primary, ...secondary, red, ...harmonies];
}

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * A brand from one color. Throws when the seed is not a color, or sits
 * beyond the gamut's safe chroma at its lightness.
 */
export function newBrand(name: string, seed: string, gamut: Gamut): Brand {
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

export function rampsOf(brand: Brand): Ramp[] {
  return brand.ramps.map((r) => ({ name: r.name, steps: r.steps }));
}

export function hasRamp(brand: Brand, name: string): boolean {
  return brand.ramps.some((r) => r.name === name);
}

/** The ramp a role plays when the eye has not chosen: what the seeds give it. */
export function defaultRampOf(brand: Brand, role: Role): string {
  const has = (name: string) => hasRamp(brand, name);
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

/** Which ramp plays this role: the one the eye chose, if the brand still has it, else the default. */
export function rampOf(brand: Brand, role: Role): string {
  const assigned = brand.assignment[role];
  return assigned !== undefined && hasRamp(brand, assigned)
    ? assigned
    : defaultRampOf(brand, role);
}

/** Every role this ramp plays, in `ROLES` order. */
export function rolesOf(brand: Brand, ramp: string): Role[] {
  return ROLES.filter((role) => rampOf(brand, role) === ramp);
}

/** Give a ramp a role. Throws by name on a ramp the brand does not have. */
export function withRole(brand: Brand, role: Role, ramp: string): Brand {
  if (!hasRamp(brand, ramp)) {
    throw new Error(`no ramp named "${ramp}" to play ${role}`);
  }
  return { ...brand, assignment: { ...brand.assignment, [role]: ramp } };
}

/** The brand's roles as the preset takes them: a ramp per role, and the chart series on their ramps at the preset's steps. */
export function assignmentOf(brand: Brand): ShadcnAssignment {
  const series = (scheme: Scheme) => {
    const [s1, s2, s3, s4, s5] = SHADCN_CHART_STEPS[scheme];
    const at = (i: 1 | 2 | 3 | 4 | 5, step: number) => ({
      ramp: rampOf(brand, `chart-${i}`),
      step,
    });
    return [at(1, s1), at(2, s2), at(3, s3), at(4, s4), at(5, s5)] as const;
  };
  return {
    neutral: rampOf(brand, "neutral"),
    primary: rampOf(brand, "primary"),
    destructive: rampOf(brand, "destructive"),
    secondary: rampOf(brand, "secondary"),
    accent: rampOf(brand, "accent"),
    sidebar: rampOf(brand, "sidebar"),
    ring: rampOf(brand, "ring"),
    charts: { light: series("light"), dark: series("dark") },
  };
}

/** The preset's bindings with the eye's overrides applied: each on the ramp its role plays. */
export function bindingsOf(brand: Brand): {
  light: Binding[];
  dark: Binding[];
} {
  const preset = shadcnBindings(assignmentOf(brand), rampsOf(brand));
  const apply = (scheme: Scheme): Binding[] =>
    preset[scheme].map((b) => {
      const o = brand.overrides[scheme][b.token];
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

export function specOf(brand: Brand): TokenSetSpec {
  return { ramps: rampsOf(brand), gamut: brand.gamut, ...bindingsOf(brand) };
}

export function auditOf(brand: Brand): TokenSetAudit {
  return auditTokenSet(specOf(brand));
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
  brand: Brand,
  scheme: Scheme,
  token: string,
): Override | null {
  const from = fromOf(brand, scheme, token);
  const solved = withOverride(brand, scheme, token, { solve: true, from });
  const outcome = auditOf(solved)[scheme].find(
    (a) => a.token === token,
  )?.outcome;
  return outcome === undefined || outcome.kind === "unresolved"
    ? null
    : { step: outcome.resolved.step };
}

/** Which end a solve walks from for this token: the override's, else the preset's, else the start. */
export function fromOf(brand: Brand, scheme: Scheme, token: string): RampEnd {
  const o = brand.overrides[scheme][token];
  if (o !== undefined && "solve" in o) return o.from;
  const preset = shadcnBindings(assignmentOf(brand), rampsOf(brand))[
    scheme
  ].find((b) => b.token === token);
  return preset?.from ?? "start";
}

export function withOverride(
  brand: Brand,
  scheme: Scheme,
  token: string,
  override: Override | null,
): Brand {
  const next = { ...brand.overrides[scheme] };
  if (override === null) delete next[token];
  else next[token] = override;
  return { ...brand, overrides: { ...brand.overrides, [scheme]: next } };
}

export function withStep(
  brand: Brand,
  rampName: string,
  index: number,
  step: OkLCH,
): Brand {
  return {
    ...brand,
    ramps: brand.ramps.map((r) =>
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
function redrawn(brand: Brand, keep: readonly string[]): Brand {
  const kept = new Map(
    brand.ramps.filter((r) => keep.includes(r.name)).map((r) => [r.name, r]),
  );
  return {
    ...brand,
    ramps: draftRamps(brand).map((r) => kept.get(r.name) ?? r),
  };
}

/** A new primary seed: the primary, the neutral tint, and the harmonies redraw; the secondary and the red keep the eye's steps. */
export function withPrimary(brand: Brand, primary: OkLCH): Brand {
  return redrawn({ ...brand, primary }, ["secondary", "red"]);
}

/**
 * A new secondary seed, or none. The secondary redraws; everything built
 * on the hue source redraws too when that source is or was the secondary.
 */
export function withSecondary(brand: Brand, secondary: OkLCH | null): Brand {
  const next = { ...brand, secondary };
  const sourceIsPrimary =
    hueSourceOf(brand.primary, brand.secondary) === brand.primary &&
    hueSourceOf(next.primary, next.secondary) === next.primary;
  return redrawn(
    next,
    sourceIsPrimary
      ? brand.ramps.map((r) => r.name).filter((n) => n !== "secondary")
      : ["primary", "red"],
  );
}

/** Another harmony: only the harmony ramps redraw. */
export function withHarmony(brand: Brand, harmony: HarmonyKind): Brand {
  return redrawn(
    { ...brand, harmony },
    brand.ramps.map((r) => r.name).filter((n) => !n.startsWith("harmony-")),
  );
}

export function withGamut(brand: Brand, gamut: Gamut): Brand {
  return { ...brand, gamut };
}

export function serialize(brand: Brand): string {
  return JSON.stringify(brand, null, 2);
}

function isColor(v: unknown): v is OkLCH {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (["L", "C", "H"] as const).every(
    (ch) => typeof c[ch] === "number" && Number.isFinite(c[ch]),
  );
}

/** Reads a brand back, naming what is wrong with it. */
export function parse(text: string): Brand {
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
  const brand = b as unknown as Brand;
  const names = new Set(brand.ramps.map((r) => r.name));
  if (typeof brand.assignment !== "object" || brand.assignment === null) {
    throw new Error("assignment is not an object");
  }
  for (const [role, v] of Object.entries(brand.assignment)) {
    if (!(ROLES as readonly string[]).includes(role)) {
      throw new Error(`"${role}" is not a role`);
    }
    if (!names.has(v as string)) {
      throw new Error(
        `${role} names ramp "${String(v)}", which the brand does not have`,
      );
    }
  }
  for (const s of ["light", "dark"] as const) {
    for (const [t, o] of Object.entries(brand.overrides?.[s] ?? {})) {
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
  return brand;
}
