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
/** The roles a ramp can play; `charts` is per-step and lives in overrides. */
export type ShadcnRole =
  "neutral" | "primary" | "destructive" | "secondary" | "accent";

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

/** The eye's replacement for one token's preset binding. Surface and target stay the preset's. */
export type Override =
  | { readonly ramp: string; readonly step: number }
  | { readonly ramp: string; readonly solve: true; readonly from: RampEnd };

export interface Brand {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly gamut: Gamut;
  readonly radius: string;
  readonly ramps: readonly BrandRamp[];
  readonly assignment: ShadcnAssignment;
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
    version: 1,
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

/** The preset's bindings with the eye's overrides applied. */
export function bindingsOf(brand: Brand): {
  light: Binding[];
  dark: Binding[];
} {
  const preset = shadcnBindings(brand.assignment, rampsOf(brand));
  const apply = (scheme: Scheme): Binding[] =>
    preset[scheme].map((b) => {
      const o = brand.overrides[scheme][b.token];
      if (o === undefined) return b;
      const pairing =
        b.on === undefined || b.target === undefined
          ? {}
          : { on: b.on, target: b.target };
      return "solve" in o
        ? { token: b.token, ramp: o.ramp, ...pairing, from: o.from }
        : { token: b.token, ramp: o.ramp, step: o.step, ...pairing };
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
  const ramp = bindingsOf(brand)[scheme].find((b) => b.token === token)?.ramp;
  if (ramp === undefined) return null;
  const solved = withOverride(brand, scheme, token, {
    ramp,
    solve: true,
    from,
  });
  const outcome = auditOf(solved)[scheme].find(
    (a) => a.token === token,
  )?.outcome;
  return outcome === undefined || outcome.kind === "unresolved"
    ? null
    : { ramp, step: outcome.resolved.step };
}

/** Which end a solve walks from for this token: the override's, else the preset's, else the start. */
export function fromOf(brand: Brand, scheme: Scheme, token: string): RampEnd {
  const o = brand.overrides[scheme][token];
  if (o !== undefined && "solve" in o) return o.from;
  const preset = shadcnBindings(brand.assignment, rampsOf(brand))[scheme].find(
    (b) => b.token === token,
  );
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

/** Removes a ramp no role or override names. Throws by name otherwise. */
export function withoutRamp(brand: Brand, name: string): Brand {
  const roles = Object.entries(brand.assignment).filter(
    ([role, v]) => role !== "charts" && v === name,
  );
  if (roles.length > 0) {
    throw new Error(
      `ramp "${name}" plays ${roles.map(([r]) => r).join(", ")}; assign another ramp first`,
    );
  }
  const used = (["light", "dark"] as const).flatMap((s) =>
    Object.entries(brand.overrides[s])
      .filter(([, o]) => o.ramp === name)
      .map(([t]) => `${s}/${t}`),
  );
  if (used.length > 0) {
    throw new Error(
      `ramp "${name}" is picked by ${used.join(", ")}; move those first`,
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

/** Reads a brand back, naming what is wrong with it. */
export function parse(text: string): Brand {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== "object" || raw === null) throw new Error("not an object");
  const b = raw as Record<string, unknown>;
  if (b["version"] !== 1)
    throw new Error(`version ${String(b["version"])} is not 1`);
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
  const brand = raw as Brand;
  const names = new Set(brand.ramps.map((r) => r.name));
  for (const [role, v] of Object.entries(brand.assignment)) {
    if (role !== "charts" && !names.has(v as string)) {
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
      if (!names.has(o.ramp)) {
        throw new Error(
          `${s} override "${t}" names ramp "${o.ramp}", which the brand does not have`,
        );
      }
    }
  }
  return brand;
}
