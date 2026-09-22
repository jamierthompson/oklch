import {
  HARMONY_KINDS,
  inspectRamp,
  type OkLCH,
  type TokenAudit,
} from "@jamiethompson/oklch";
import { useMemo } from "react";

import { Field } from "@/components/Field.tsx";
import { Swatch } from "@/components/Swatch.tsx";
import { Verdict } from "@/components/Verdict.tsx";
import { Badge } from "@/components/ui/badge";
import {
  rampOf,
  ROLES,
  type Brand,
  type BrandRamp,
  type Role,
} from "@/lib/brand.ts";
import { fixed, stopName } from "@/lib/format.ts";
import { usedBy, type Usage } from "@/lib/usage.ts";

/** How a token came to sit on this step. */
function howOf(brand: Brand, a: TokenAudit): "override" | "solved" | "picked" {
  if (brand.overrides[a.scheme][a.token] !== undefined) return "override";
  return a.outcome.kind !== "unresolved" && a.outcome.resolved.how === "solved"
    ? "solved"
    : "picked";
}

/** What drew this ramp: the seed's hue, or the offset from it. */
function subtitleOf(brand: Brand, ramp: BrandRamp): string {
  const hue = `H ${fixed(ramp.steps[5]?.H ?? 0, 1)}°`;
  const n = ramp.name.match(/^harmony-(\d+)$/);
  if (n === null) return hue;
  const offset = HARMONY_KINDS[brand.harmony][Number(n[1]) - 1] ?? 0;
  return `${offset > 0 ? "+" : ""}${offset}° → ${hue}`;
}

/**
 * One ramp: its roles, its steps, and the step the eye has selected, with
 * every token that lands on that step and each one's verdict on its own
 * surface. The roles are how a ramp reaches the tokens: a token's ramp is
 * its role's, so a ramp that plays nothing colors nothing. The sliders
 * move the selected step; the seeds in the rail redraw the ramp.
 */
export function RampEditor({
  brand,
  ramp,
  usage,
  selected,
  onSelect,
  onShowToken,
  onRole,
  onStep,
}: {
  brand: Brand;
  ramp: BrandRamp;
  usage: Usage;
  /** The selected step, when the selection is on this ramp. */
  selected: number | null;
  onSelect: (step: number) => void;
  onShowToken: (a: TokenAudit) => void;
  /** Give this ramp a role. */
  onRole: (role: Role) => void;
  onStep: (index: number, step: OkLCH) => void;
}) {
  const report = useMemo(
    () => inspectRamp(ramp.steps, brand.gamut),
    [ramp.steps, brand.gamut],
  );
  const onStepTokens = (i: number) =>
    usedBy(usage, { ramp: ramp.name, step: i });

  return (
    <section
      id={`ramp-${ramp.name}`}
      className="grid scroll-mt-4 gap-3 rounded-lg border p-3"
      aria-label={`ramp ${ramp.name}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{ramp.name}</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {subtitleOf(brand, ramp)}
        </span>
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label={`${ramp.name} roles`}
        >
          {ROLES.map((role) => {
            const plays = rampOf(brand, role) === ramp.name;
            return (
              <Badge
                key={role}
                variant={plays ? "default" : "outline"}
                className={plays ? "" : "text-muted-foreground"}
                render={
                  <button
                    type="button"
                    aria-pressed={plays}
                    aria-label={`${role} role on ${ramp.name}`}
                    title={
                      plays
                        ? `${ramp.name} plays ${role}`
                        : `Make ${ramp.name} the ${role} ramp`
                    }
                    onClick={() => !plays && onRole(role)}
                  />
                }
              >
                {role.replace("-", " ")}
              </Badge>
            );
          })}
        </div>
      </div>

      <div
        className="flex gap-1"
        role="group"
        aria-label={`${ramp.name} steps`}
      >
        {ramp.steps.map((s, i) => {
          const tokens = onStepTokens(i);
          const failing = tokens.some((a) => a.outcome.kind !== "clears");
          const isSelected = i === selected;
          const isSeed = ramp.seed === i;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${ramp.name} ${stopName(i)}`}
              aria-pressed={isSelected}
              title={
                (isSeed ? "the seed, exactly\n" : "") +
                (tokens.length === 0
                  ? "No token lands here"
                  : tokens.map((a) => `${a.scheme} ${a.token}`).join("\n"))
              }
              onClick={() => onSelect(i)}
              className="min-w-0 flex-1"
            >
              <Swatch
                color={s}
                className={
                  isSelected
                    ? "w-full ring-2 ring-ring ring-offset-2 ring-offset-background"
                    : failing
                      ? "w-full ring-2 ring-destructive ring-offset-1 ring-offset-background"
                      : isSeed
                        ? "w-full ring-2 ring-foreground ring-offset-1 ring-offset-background"
                        : "w-full"
                }
              />
              <span className="block text-center text-[10px] text-muted-foreground">
                {stopName(i)}
                {isSeed ? " ·" : ""}
              </span>
              <span
                className={
                  "block min-h-3.5 text-center text-[10px] " +
                  (failing ? "text-destructive" : "text-muted-foreground")
                }
                aria-label={
                  tokens.length === 0
                    ? `no token on ${ramp.name} ${stopName(i)}`
                    : `${tokens.length} token${tokens.length === 1 ? "" : "s"} on ${ramp.name} ${stopName(i)}`
                }
              >
                {tokens.length > 0 ? tokens.length : " "}
              </span>
            </button>
          );
        })}
      </div>

      {selected !== null && ramp.steps[selected] !== undefined && (
        <StepDetail
          brand={brand}
          ramp={ramp}
          index={selected}
          step={ramp.steps[selected]}
          inspected={report.steps[selected]!}
          tokens={onStepTokens(selected)}
          onShowToken={onShowToken}
          onStep={onStep}
        />
      )}
    </section>
  );
}

/** The selected step: what it measures, the sliders that move it, and the tokens that land on it. */
function StepDetail({
  brand,
  ramp,
  index,
  step,
  inspected,
  tokens,
  onShowToken,
  onStep,
}: {
  brand: Brand;
  ramp: BrandRamp;
  index: number;
  step: OkLCH;
  inspected: ReturnType<typeof inspectRamp>["steps"][number];
  tokens: readonly TokenAudit[];
  onShowToken: (a: TokenAudit) => void;
  onStep: (index: number, step: OkLCH) => void;
}) {
  return (
    <div className="grid gap-2" aria-label={`${ramp.name} ${stopName(index)}`}>
      <div className="text-xs text-muted-foreground">
        step {stopName(index)} · chroma {fixed(inspected.chromaShare * 100, 0)}%
        of what {brand.gamut} allows
        {inspected.onCusp ? " · on the cusp" : ""}
        {inspected.map.moved
          ? ` · mapped into ${brand.gamut}, ΔE ${fixed(inspected.map.deltaEOK)}`
          : ""}
      </div>
      <Field
        label="L"
        value={step.L}
        min={0}
        max={1}
        step={0.001}
        onChange={(L) => onStep(index, { ...step, L })}
      />
      <Field
        label="C"
        value={step.C}
        min={0}
        max={0.4}
        step={0.001}
        onChange={(C) => onStep(index, { ...step, C })}
      />
      <Field
        label="H"
        value={step.H}
        min={0}
        max={360}
        step={0.1}
        digits={1}
        onChange={(H) => onStep(index, { ...step, H })}
      />
      <div className="grid gap-1" aria-label="tokens on this step">
        <div className="text-xs text-muted-foreground">
          {tokens.length === 0
            ? "No token lands on this step."
            : `On this step, measured where each token sits:`}
        </div>
        {tokens.map((a) => (
          <div
            key={`${a.scheme}/${a.token}`}
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            <button
              type="button"
              className="font-mono underline-offset-4 hover:underline"
              title="Show this token in the table"
              onClick={() => onShowToken(a)}
            >
              {a.scheme} · {a.token}
            </button>
            <span className="text-muted-foreground">{howOf(brand, a)}</span>
            <Verdict a={a} />
          </div>
        ))}
      </div>
    </div>
  );
}
