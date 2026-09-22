/**
 * A brand: the ramps the eye drew, which ramp plays which shadcn role, and
 * the steps the eye moved off the preset. Everything derived — bindings,
 * audit, exports — is a pure function of this document.
 */

import {
  auditTokenSet,
  createRamp,
  formatOklch,
  parseColor,
  SHADCN_CHART_STEPS,
  SHADCN_TOKENS,
  shadcnBindings,
  TAILWIND_STOPS,
  type AuditOutcome,
  type Binding,
  type Gamut,
  type OkLCH,
  type Ramp,
  type RampEnd,
  type ShadcnAssignment,
  type TokenSetAudit,
  type TokenSetSpec,
} from "@jamiethompson/oklch";

export type Scheme = "light" | "dark";
export type Stops = "chromatic" | "neutral";

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
type RequiredRole = "neutral" | "primary" | "destructive";

/** Which ramp plays which role. A role left out plays on its default: `primary` for a chart series, `neutral` otherwise. */
export type Assignment = { readonly [R in RequiredRole]: string } & {
  readonly [R in Exclude<Role, RequiredRole>]?: string;
};

/** How a ramp was drafted; regenerating replays it over the eye's edits. */
export type RampSeed =
  | {
      readonly kind: "hue";
      readonly hue: number;
      readonly saturation: number;
      readonly stops: Stops;
      readonly hueShift: number;
    }
  | {
      readonly kind: "through";
      /** A CSS color, as typed. */
      readonly color: string;
      readonly stops: Stops;
      readonly hueShift: number;
    };

export interface BrandRamp {
  readonly name: string;
  readonly seed: RampSeed;
  /** The steps as they stand: drafted from `seed`, then moved by eye. */
  readonly steps: readonly OkLCH[];
}

/** The eye's replacement for one token's preset step, on the ramp its role plays. Surface and target stay the preset's. */
export type Override =
  { readonly step: number } | { readonly solve: true; readonly from: RampEnd };

export const BRAND_VERSION = 2;

export interface Brand {
  readonly version: typeof BRAND_VERSION;
  readonly id: string;
  readonly name: string;
  readonly gamut: Gamut;
  readonly radius: string;
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

export function draftSteps(seed: RampSeed, gamut: Gamut): readonly OkLCH[] {
  const lightness = TAILWIND_STOPS[seed.stops];
  if (seed.kind === "hue") {
    return createRamp({
      hue: seed.hue,
      saturation: seed.saturation,
      hueShift: seed.hueShift,
      lightness,
      gamut,
    }).steps;
  }
  const through = parseColor(seed.color);
  if (through === null) {
    throw new Error(`"${seed.color}" is not a color this package reads`);
  }
  return createRamp({ through, hueShift: seed.hueShift, lightness, gamut })
    .steps;
}

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * A brand from one color: a neutral tinted to its hue, the brand ramp drawn
 * through it, and a red for destructive. Throws when the seed is not a
 * color, or sits beyond the gamut's safe chroma at its lightness.
 */
export function newBrand(name: string, seed: string, gamut: Gamut): Brand {
  const color = parseColor(seed);
  if (color === null) {
    throw new Error(`"${seed}" is not a color this package reads`);
  }
  const seeds: { name: string; seed: RampSeed }[] = [
    {
      name: "neutral",
      seed: {
        kind: "hue",
        hue: color.H,
        saturation: NEUTRAL_TINT,
        stops: "neutral",
        hueShift: 0,
      },
    },
    {
      name: "brand",
      seed: { kind: "through", color: seed, stops: "chromatic", hueShift: 0 },
    },
    {
      name: "red",
      seed: {
        kind: "hue",
        hue: DESTRUCTIVE_HUE,
        saturation: 0.85,
        stops: "chromatic",
        hueShift: 0,
      },
    },
  ];
  return {
    version: BRAND_VERSION,
    id: newId(),
    name,
    gamut,
    radius: "0.625rem",
    ramps: seeds.map((r) => ({ ...r, steps: draftSteps(r.seed, gamut) })),
    assignment: { neutral: "neutral", primary: "brand", destructive: "red" },
    overrides: { light: {}, dark: {} },
  };
}

export function rampsOf(brand: Brand): Ramp[] {
  return brand.ramps.map((r) => ({ name: r.name, steps: r.steps }));
}

/** Which ramp plays this role: the one assigned, else the role's default. */
export function rampOf(brand: Brand, role: Role): string {
  const assigned = brand.assignment[role];
  if (assigned !== undefined) return assigned;
  return role.startsWith("chart-")
    ? brand.assignment.primary
    : brand.assignment.neutral;
}

/** Every role this ramp plays, in `ROLES` order. */
export function rolesOf(brand: Brand, ramp: string): Role[] {
  return ROLES.filter((role) => rampOf(brand, role) === ramp);
}

/** Give a ramp a role. Throws by name on a ramp the brand does not have. */
export function withRole(brand: Brand, role: Role, ramp: string): Brand {
  if (!brand.ramps.some((r) => r.name === ramp)) {
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

export function withSeed(
  brand: Brand,
  rampName: string,
  seed: RampSeed,
): Brand {
  return {
    ...brand,
    ramps: brand.ramps.map((r) =>
      r.name === rampName
        ? { ...r, seed, steps: draftSteps(seed, brand.gamut) }
        : r,
    ),
  };
}

const RAMP_NAME = /^[a-z][a-z0-9-]*$/;

export function withRamp(brand: Brand, name: string, seed: RampSeed): Brand {
  if (!RAMP_NAME.test(name)) {
    throw new Error(
      `ramp name "${name}" must be lowercase letters, digits and hyphens, starting with a letter`,
    );
  }
  if (brand.ramps.some((r) => r.name === name)) {
    throw new Error(`a ramp named "${name}" already exists`);
  }
  return {
    ...brand,
    ramps: [
      ...brand.ramps,
      { name, seed, steps: draftSteps(seed, brand.gamut) },
    ],
  };
}

/** Removes a ramp that plays no role. Throws by name otherwise. */
export function withoutRamp(brand: Brand, name: string): Brand {
  const roles = rolesOf(brand, name);
  if (roles.length > 0) {
    throw new Error(
      `ramp "${name}" plays ${roles.join(", ")}; give ${roles.length === 1 ? "that role" : "those roles"} another ramp first`,
    );
  }
  return { ...brand, ramps: brand.ramps.filter((r) => r.name !== name) };
}

export function withGamut(brand: Brand, gamut: Gamut): Brand {
  return { ...brand, gamut };
}

export function serialize(brand: Brand): string {
  return JSON.stringify(brand, null, 2);
}

/**
 * A version 1 document, as version 2. Version 1 let an override name a
 * ramp of its own; now a token's ramp is its role's, so the ramp is
 * dropped and the step or solve kept. A step that was picked on another
 * ramp lands on the role's ramp at the same index, where the audit will
 * say whether it clears.
 */
function migrate(b: Record<string, unknown>): Record<string, unknown> {
  if (b["version"] !== 1) return b;
  const overrides = (b["overrides"] ?? {}) as Record<
    string,
    Record<string, Record<string, unknown>>
  >;
  const strip = (scheme: string) =>
    Object.fromEntries(
      Object.entries(overrides[scheme] ?? {}).map(([token, o]) => {
        const rest = { ...o };
        delete rest["ramp"];
        return [token, rest];
      }),
    );
  const assignment = {
    ...((b["assignment"] ?? {}) as Record<string, unknown>),
  };
  delete assignment["charts"];
  return {
    ...b,
    version: BRAND_VERSION,
    assignment,
    overrides: { light: strip("light"), dark: strip("dark") },
  };
}

/** Reads a brand back, naming what is wrong with it. A version 1 file is read as version 2. */
export function parse(text: string): Brand {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== "object" || raw === null) throw new Error("not an object");
  const b = migrate(raw as Record<string, unknown>);
  if (b["version"] !== BRAND_VERSION)
    throw new Error(`version ${String(b["version"])} is not ${BRAND_VERSION}`);
  for (const key of ["id", "name", "radius"] as const) {
    if (typeof b[key] !== "string") throw new Error(`${key} is not a string`);
  }
  if (b["gamut"] !== "srgb" && b["gamut"] !== "p3") {
    throw new Error(`gamut ${String(b["gamut"])} is not "srgb" or "p3"`);
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
      const step = s as Record<string, unknown>;
      for (const ch of ["L", "C", "H"] as const) {
        if (typeof step[ch] !== "number" || !Number.isFinite(step[ch])) {
          throw new Error(
            `ramp "${ramp["name"]}" has a step whose ${ch} is not a number`,
          );
        }
      }
    }
  }
  const brand = b as unknown as Brand;
  const names = new Set(brand.ramps.map((r) => r.name));
  if (typeof brand.assignment !== "object" || brand.assignment === null) {
    throw new Error("assignment is not an object");
  }
  for (const role of ["neutral", "primary", "destructive"] as const) {
    if (typeof brand.assignment[role] !== "string") {
      throw new Error(`${role} names no ramp`);
    }
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
