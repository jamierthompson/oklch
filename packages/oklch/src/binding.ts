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
import { minPass } from "./tier2.js";

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
 * solved: the first step of the ramp that clears `target` on `on`.
 */
export interface Binding {
  /** The semantic role: a CSS identifier such as `surface` or `ink-muted`. */
  readonly token: string;
  readonly ramp: string;
  readonly step?: number;
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
export interface Receipt {
  readonly token: string;
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
  binding: { token: string; on: string; target: ContrastTarget },
  check: ContrastCheck,
  measured: Receipt["measured"],
): Receipt {
  return {
    token: binding.token,
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
        { token, on: surface.token, target: binding.target },
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
    found = minPass(shipped, surface.fallback.color, binding.target);
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
  /** Resolved in order; a surface must come before the inks that sit on it. */
  readonly bindings: readonly Binding[];
  readonly gamut: Gamut;
}

export interface TokenSet {
  readonly gamut: Gamut;
  readonly tokens: readonly ResolvedToken[];
  /** One per pairing, in binding order. */
  readonly receipts: readonly Receipt[];
}

/**
 * Bind these ramps to these semantic roles, with a receipt per pairing.
 *
 * Nothing more than `resolveBinding` in order, so anything this builds can
 * be rebuilt one binding at a time. Throws on an empty binding list and on
 * whatever any binding refuses.
 */
export function buildTokenSet(spec: TokenSetSpec): TokenSet {
  if (!GAMUTS.includes(spec.gamut)) {
    throw new TypeError(
      `buildTokenSet: gamut is ${String(spec.gamut)}; pass "srgb" or "p3". There is no default.`,
    );
  }
  if (spec.bindings.length === 0) {
    throw new RangeError(
      "buildTokenSet: there are no bindings; a token set with no tokens is not one",
    );
  }
  const tokens: ResolvedToken[] = [];
  for (const binding of spec.bindings) {
    tokens.push(
      resolveBinding(binding, { ramps: spec.ramps, tokens, gamut: spec.gamut }),
    );
  }
  return {
    gamut: spec.gamut,
    tokens,
    receipts: tokens.flatMap((t) => (t.receipt === null ? [] : [t.receipt])),
  };
}
