/**
 * Tier 3: every token's verdict, without a refusal ending the walk. What an
 * editor renders while the eye is still moving steps; `buildTokenSet` is
 * what ships once every verdict clears.
 */

import {
  checkContrast,
  GAMUTS,
  type ContrastCheck,
  type ContrastTarget,
} from "./tier1.js";
import {
  buildTokenSet,
  resolveBinding,
  type Binding,
  type ResolvedToken,
  type Scheme,
  type TokenSet,
  type TokenSetSpec,
} from "./binding.js";

/** What became of one binding. */
export type AuditOutcome =
  /** Bound, and any pairing clears: the receipt is on `resolved`. */
  | { readonly kind: "clears"; readonly resolved: ResolvedToken }
  /** A picked step whose pairing does not clear. The color is known, so inks on it still resolve. */
  | {
      readonly kind: "fails";
      readonly resolved: ResolvedToken;
      readonly on: string;
      readonly target: ContrastTarget;
      readonly check: ContrastCheck;
    }
  /** No color at all: a bad step, an unknown ramp, a solve with no clearing step, or a surface that is itself unresolved. */
  | { readonly kind: "unresolved"; readonly reason: string };

export interface TokenAudit {
  readonly token: string;
  readonly scheme: Scheme;
  readonly binding: Binding;
  readonly outcome: AuditOutcome;
}

export interface TokenSetAudit {
  readonly light: readonly TokenAudit[];
  readonly dark: readonly TokenAudit[];
  /** Problems with the spec as a whole, not with one binding: a token bound in one scheme only, an empty scheme. */
  readonly problems: readonly string[];
  /** Every outcome clears and there are no problems. */
  readonly passes: boolean;
  /** The set, when it passes: exactly what `buildTokenSet` returns. Null otherwise. */
  readonly set: TokenSet | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Every token's verdict, in both schemes.
 *
 * The same walk as `buildTokenSet`, but a binding that would be refused is
 * recorded and the walk goes on. A picked step whose pairing does not
 * clear is still resolved to its color, measured, and reported as `fails`
 * with the check attached, so the inks that sit on it still get their own
 * verdicts. A binding that has no color to give — a solve no step clears,
 * a step outside the ramp, a surface that is itself unresolved — is
 * `unresolved` by name, and everything on it follows.
 *
 * When every verdict clears, `set` is `buildTokenSet(spec)`, so an editor
 * that shows this audit can ship from it without a second walk. Throws
 * only on a missing gamut: everything else is a verdict, not a refusal.
 */
export function auditTokenSet(spec: TokenSetSpec): TokenSetAudit {
  const fn = "auditTokenSet";
  if (!GAMUTS.includes(spec.gamut)) {
    throw new TypeError(
      `${fn}: gamut is ${String(spec.gamut)}; pass "srgb" or "p3". There is no default.`,
    );
  }

  const walk = (scheme: Scheme): TokenAudit[] => {
    const tokens: ResolvedToken[] = [];
    const audits: TokenAudit[] = [];
    for (const binding of spec[scheme]) {
      const context = { ramps: spec.ramps, tokens, scheme, gamut: spec.gamut };
      let outcome: AuditOutcome;
      try {
        const resolved = resolveBinding(binding, context);
        tokens.push(resolved);
        outcome = { kind: "clears", resolved };
      } catch (refusal) {
        outcome = { kind: "unresolved", reason: message(refusal) };
        const surface =
          binding.on === undefined
            ? undefined
            : tokens.find((t) => t.token === binding.on);
        if (
          binding.step !== undefined &&
          binding.on !== undefined &&
          binding.target !== undefined &&
          surface !== undefined
        ) {
          // A pick that was refused for its pairing alone still has a color.
          try {
            const resolved = resolveBinding(
              { token: binding.token, ramp: binding.ramp, step: binding.step },
              context,
            );
            const check = checkContrast(
              resolved.fallback.color,
              surface.fallback.color,
              binding.target,
            );
            if (!check.passes) {
              tokens.push(resolved);
              outcome = {
                kind: "fails",
                resolved,
                on: surface.token,
                target: binding.target,
                check,
              };
            }
          } catch {
            // The pick itself was the problem; the first refusal names it.
          }
        }
      }
      audits.push({ token: binding.token, scheme, binding, outcome });
    }
    return audits;
  };

  const light = walk("light");
  const dark = walk("dark");

  const problems: string[] = [];
  for (const scheme of ["light", "dark"] as const) {
    if (spec[scheme].length === 0) {
      problems.push(
        `the ${scheme} scheme has no bindings; light and dark are one set`,
      );
    }
  }
  const names = (audits: TokenAudit[]): Set<string> =>
    new Set(audits.map((a) => a.token));
  const lightNames = names(light);
  const darkNames = names(dark);
  for (const n of lightNames) {
    if (!darkNames.has(n)) problems.push(`"${n}" has no dark binding`);
  }
  for (const n of darkNames) {
    if (!lightNames.has(n)) problems.push(`"${n}" has no light binding`);
  }

  const passes =
    problems.length === 0 &&
    [...light, ...dark].every((a) => a.outcome.kind === "clears");

  return {
    light,
    dark,
    problems,
    passes,
    set: passes ? buildTokenSet(spec) : null,
  };
}
