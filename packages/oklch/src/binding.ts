/**
 * Tier 3: bind the steps an eye placed to semantic roles, with a receipt per
 * pairing. The opinion layer — every part rebuildable from Tiers 1 and 2.
 */

import {
  checkContrast,
  GAMUTS,
  gamutMap,
  type ContrastCheck,
  type ContrastTarget,
  type Gamut,
  type GamutMapReport,
  type MeterReading,
  type OkLCH,
} from "./tier1.js";
import { minPass, type RampEnd } from "./tier2.js";

/** A named list of steps the eye placed. */
export interface Ramp {
  readonly name: string;
  readonly steps: readonly OkLCH[];
}

/**
 * How a token gets its color.
 *
 * With `step`, the token is that step of the ramp, picked by eye. With `on`
 * and `target` as well, the pick is verified against the surface token
 * named, and a pick that fails is refused. Without `step`, the token is
 * solved: the first step of the ramp that clears `target` on `on`, walking
 * from the ramp's first step, or from its last with `from: "end"`.
 */
export interface Binding {
  /** The semantic role: a CSS identifier such as `surface` or `ink-muted`. */
  readonly token: string;
  readonly ramp: string;
  readonly step?: number;
  /** For a solve only: which end of the ramp to walk from. Default `"start"`. */
  readonly from?: RampEnd;
  /** The token this one will sit on. Must already be bound. */
  readonly on?: string;
  readonly target?: ContrastTarget;
}

/** The standards a receipt answers to. A number without its standard invites misplaced confidence. */
export const STANDARDS = {
  wcag: "WCAG 2.2 contrast ratio (conformance)",
  apca: "APCA-W3 Lc (perceptual; not a conformance standard)",
} as const;

/** A usage guarantee for one pairing: this token on that surface was verified, and by which standard. */
export type Scheme = "light" | "dark";

export interface Receipt {
  readonly token: string;
  readonly scheme: Scheme;
  readonly on: string;
  readonly target: ContrastTarget;
  readonly wcag: MeterReading & { readonly standard: typeof STANDARDS.wcag };
  readonly apca: MeterReading & {
    readonly standard: typeof STANDARDS.apca;
    readonly polarity: ContrastCheck["apca"]["polarity"];
  };
  /** The colors the meters saw: both tokens' sRGB fallbacks. */
  readonly measured: { readonly token: OkLCH; readonly on: OkLCH };
}

export interface ResolvedToken {
  readonly token: string;
  readonly ramp: string;
  readonly step: number;
  readonly how: "picked" | "solved";
  /** The step as placed. */
  readonly requested: OkLCH;
  /** The step mapped into the set's gamut, and what that moved. */
  readonly map: GamutMapReport;
  /** What ships: `map.color`. */
  readonly color: OkLCH;
  /** What non-P3 screens get: `color` mapped into sRGB. */
  readonly fallback: GamutMapReport;
  /** The pairing's receipt, or null for a token bound to no surface. */
  readonly receipt: Receipt | null;
}

export interface BindingContext {
  readonly ramps: readonly Ramp[];
  /** The scheme being bound; it travels on the receipt. */
  readonly scheme: Scheme;
  /** Tokens already resolved, in order; `on` may name any of them. */
  readonly tokens: readonly ResolvedToken[];
  readonly gamut: Gamut;
}

/** A CSS custom-property identifier, with nothing to normalize. */
const IDENT = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

function assertIdent(fn: string, what: string, name: string): string {
  if (!IDENT.test(name)) {
    throw new TypeError(
      `${fn}: ${what} "${name}" is not a CSS identifier (letters, digits, - and _, not starting with a digit). ` +
        `Nothing here renames it silently.`,
    );
  }
  return name;
}

function receiptFrom(
  binding: {
    token: string;
    scheme: Scheme;
    on: string;
    target: ContrastTarget;
  },
  check: ContrastCheck,
  measured: Receipt["measured"],
): Receipt {
  return {
    token: binding.token,
    scheme: binding.scheme,
    on: binding.on,
    target: binding.target,
    wcag: { ...check.wcag, standard: STANDARDS.wcag },
    apca: { ...check.apca, standard: STANDARDS.apca },
    measured,
  };
}

/**
 * Bind one token.
 *
 * Refuses by name: an unknown ramp, a step outside it, a surface token that
 * is not bound yet, `on` without `target` or the reverse, a token name that
 * is not a CSS identifier, and — the one garden fell back on — a pick or a
 * solve that does not clear. There is no fallback color.
 */
export function resolveBinding(
  binding: Binding,
  context: BindingContext,
): ResolvedToken {
  const fn = "resolveBinding";
  const token = assertIdent(fn, "token", binding.token);
  if (!GAMUTS.includes(context.gamut)) {
    throw new TypeError(
      `${fn}: gamut is ${String(context.gamut)}; pass "srgb" or "p3". There is no default.`,
    );
  }
  if (context.scheme !== "light" && context.scheme !== "dark") {
    throw new TypeError(
      `${fn}: scheme is ${String(context.scheme)}; pass "light" or "dark"`,
    );
  }
  if (context.tokens.some((t) => t.token === token)) {
    throw new RangeError(
      `${fn}: token "${token}" is already bound; a token has one color`,
    );
  }
  const ramp = context.ramps.find((r) => r.name === binding.ramp);
  if (ramp === undefined) {
    throw new RangeError(
      `${fn}: token "${token}" names ramp "${binding.ramp}", which is not one of: ${context.ramps.map((r) => r.name).join(", ") || "(none)"}`,
    );
  }
  if (ramp.steps.length === 0) {
    throw new RangeError(`${fn}: ramp "${ramp.name}" has no steps`);
  }
  if ((binding.on === undefined) !== (binding.target === undefined)) {
    throw new TypeError(
      `${fn}: token "${token}" has ${binding.on === undefined ? "a target but no surface" : "a surface but no target"}; a pairing needs both \`on\` and \`target\``,
    );
  }

  let surface: ResolvedToken | undefined;
  if (binding.on !== undefined) {
    surface = context.tokens.find((t) => t.token === binding.on);
    if (surface === undefined) {
      throw new RangeError(
        `${fn}: token "${token}" sits on "${binding.on}", which is not bound yet; bind surfaces before the inks that sit on them`,
      );
    }
  }

  const resolveStep = (
    step: number,
    how: ResolvedToken["how"],
  ): ResolvedToken => {
    const requested = ramp.steps[step]!;
    const map = gamutMap(requested, context.gamut);
    const fallback = gamutMap(map.color, "srgb");
    let receipt: Receipt | null = null;
    if (surface !== undefined && binding.target !== undefined) {
      const check = checkContrast(
        fallback.color,
        surface.fallback.color,
        binding.target,
      );
      if (!check.passes) {
        throw new RangeError(
          `${fn}: token "${token}" (${ramp.name}[${step}]) on "${surface.token}" measures ` +
            `WCAG ${check.wcag.value.toFixed(2)} against ${binding.target.wcag} and ` +
            `APCA ${check.apca.value.toFixed(1)} against ${binding.target.apca}; it does not clear. ` +
            `Pick another step, or leave out \`step\` to solve for the first that clears.`,
        );
      }
      receipt = receiptFrom(
        {
          token,
          scheme: context.scheme,
          on: surface.token,
          target: binding.target,
        },
        check,
        {
          token: fallback.color,
          on: surface.fallback.color,
        },
      );
    }
    return {
      token,
      ramp: ramp.name,
      step,
      how,
      requested,
      map: map,
      color: map.color,
      fallback,
      receipt,
    };
  };

  if (binding.step !== undefined) {
    if (binding.from !== undefined) {
      throw new TypeError(
        `${fn}: token "${token}" picks step ${binding.step} and also says from: "${binding.from}"; \`from\` is for a solve, and a pick has no walk`,
      );
    }
    if (
      !Number.isInteger(binding.step) ||
      binding.step < 0 ||
      binding.step >= ramp.steps.length
    ) {
      throw new RangeError(
        `${fn}: token "${token}" picks step ${String(binding.step)} of ramp "${ramp.name}", which has steps 0 to ${ramp.steps.length - 1}`,
      );
    }
    return resolveStep(binding.step, "picked");
  }

  if (surface === undefined || binding.target === undefined) {
    throw new TypeError(
      `${fn}: token "${token}" has no \`step\` to pick and no \`on\` + \`target\` to solve for; give it one or the other`,
    );
  }
  // Solve on what ships: each step's sRGB fallback against the surface's.
  const shipped = ramp.steps.map(
    (s) => gamutMap(gamutMap(s, context.gamut).color, "srgb").color,
  );
  let found;
  try {
    found = minPass(shipped, surface.fallback.color, binding.target, {
      from: binding.from ?? "start",
    });
  } catch (error) {
    throw new RangeError(
      `${fn}: token "${token}" cannot be solved on "${surface.token}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  return resolveStep(found.index, "solved");
}

export interface TokenSetSpec {
  readonly ramps: readonly Ramp[];
  /** Each scheme's bindings, resolved in order; a surface must come before the inks that sit on it. */
  readonly light: readonly Binding[];
  readonly dark: readonly Binding[];
  readonly gamut: Gamut;
}

/** One token in both schemes: what `light-dark()` ships. */
export interface TokenPair {
  readonly token: string;
  readonly light: ResolvedToken;
  readonly dark: ResolvedToken;
}

export interface TokenSet {
  readonly gamut: Gamut;
  /** In the light scheme's binding order. */
  readonly tokens: readonly TokenPair[];
  /** One per pairing per scheme, light first, in binding order. */
  readonly receipts: readonly Receipt[];
}

/**
 * Bind these ramps to these semantic roles, in both schemes, with a receipt
 * per pairing.
 *
 * Nothing more than `resolveBinding` in order, once per scheme, so anything
 * this builds can be rebuilt one binding at a time. Light and dark are one
 * set because they ship as one `light-dark()` value per token, so every
 * token must be bound in both; one bound in only one scheme is refused by
 * name. Throws on an empty scheme and on whatever any binding refuses.
 */
export function buildTokenSet(spec: TokenSetSpec): TokenSet {
  const fn = "buildTokenSet";
  if (!GAMUTS.includes(spec.gamut)) {
    throw new TypeError(
      `${fn}: gamut is ${String(spec.gamut)}; pass "srgb" or "p3". There is no default.`,
    );
  }
  for (const scheme of ["light", "dark"] as const) {
    if (spec[scheme].length === 0) {
      throw new RangeError(
        `${fn}: the ${scheme} scheme has no bindings; light and dark are one set, and a set with no tokens is not one`,
      );
    }
  }

  const resolve = (scheme: Scheme): ResolvedToken[] => {
    const tokens: ResolvedToken[] = [];
    for (const binding of spec[scheme]) {
      tokens.push(
        resolveBinding(binding, {
          ramps: spec.ramps,
          tokens,
          scheme,
          gamut: spec.gamut,
        }),
      );
    }
    return tokens;
  };
  const light = resolve("light");
  const dark = resolve("dark");

  const names = (tokens: ResolvedToken[]): Set<string> =>
    new Set(tokens.map((t) => t.token));
  const lightNames = names(light);
  const darkNames = names(dark);
  const onlyLight = [...lightNames].filter((n) => !darkNames.has(n));
  const onlyDark = [...darkNames].filter((n) => !lightNames.has(n));
  if (onlyLight.length > 0 || onlyDark.length > 0) {
    const missing = [
      ...onlyLight.map((n) => `"${n}" has no dark binding`),
      ...onlyDark.map((n) => `"${n}" has no light binding`),
    ];
    throw new RangeError(
      `${fn}: every token needs both schemes to ship as light-dark(): ${missing.join("; ")}`,
    );
  }

  const tokens: TokenPair[] = light.map((l) => ({
    token: l.token,
    light: l,
    dark: dark.find((d) => d.token === l.token)!,
  }));
  return {
    gamut: spec.gamut,
    tokens,
    receipts: [...light, ...dark].flatMap((t) =>
      t.receipt === null ? [] : [t.receipt],
    ),
  };
}
