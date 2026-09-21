import { inspectRamp, type OkLCH, type TokenAudit } from "@jamiethompson/oklch";
import { useMemo, useState } from "react";

import { Swatch } from "@/components/Swatch.tsx";
import { Verdict } from "@/components/Verdict.tsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type {
  Brand,
  BrandRamp,
  RampSeed,
  ShadcnRole,
  Stops,
} from "@jamiethompson/oklch-brand";
import { fixed, stopName } from "@/lib/format.ts";
import { usedBy, type Usage } from "@/lib/usage.ts";

/** The roles a ramp can play, in the order they are offered. */
export const ROLES: readonly ShadcnRole[] = [
  "neutral",
  "primary",
  "destructive",
  "secondary",
  "accent",
];

/** Which ramp plays this role; `secondary` and `accent` default to the neutral. */
export function rampOf(brand: Brand, role: ShadcnRole): string {
  return brand.assignment[role] ?? brand.assignment.neutral;
}

function Field({
  label,
  value,
  min,
  max,
  step,
  digits = 3,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[3rem_1fr_4rem] items-center gap-2">
      <Label className="text-xs">{label}</Label>
      <Slider
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0]! : v)}
      />
      <Input
        aria-label={`${label} value`}
        className="h-7 px-1 font-mono text-xs"
        type="number"
        min={min}
        max={max}
        step={step}
        value={fixed(value, digits)}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

/** How a token came to sit on this step. */
function howOf(brand: Brand, a: TokenAudit): "override" | "solved" | "picked" {
  if (brand.overrides[a.scheme][a.token] !== undefined) return "override";
  return a.outcome.kind !== "unresolved" && a.outcome.resolved.how === "solved"
    ? "solved"
    : "picked";
}

/**
 * One ramp: its roles, its steps, and the step the eye has selected, with
 * every token that lands on that step and each one's verdict on its own
 * surface. The sliders move the selected step; the seed redraws the ramp.
 */
export function RampEditor({
  brand,
  ramp,
  usage,
  selected,
  onSelect,
  onShowToken,
  onRole,
  onSeed,
  onStep,
  onRemove,
}: {
  brand: Brand;
  ramp: BrandRamp;
  usage: Usage;
  /** The selected step, when the selection is on this ramp. */
  selected: number | null;
  onSelect: (step: number) => void;
  onShowToken: (a: TokenAudit) => void;
  /** Give this ramp a role. */
  onRole: (role: ShadcnRole) => void;
  onSeed: (seed: RampSeed) => void;
  onStep: (index: number, step: OkLCH) => void;
  onRemove: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const report = useMemo(
    () => inspectRamp(ramp.steps, brand.gamut),
    [ramp.steps, brand.gamut],
  );
  const seed = ramp.seed;
  const roles = ROLES.filter((role) => rampOf(brand, role) === ramp.name);
  const onStepTokens = (i: number) =>
    usedBy(usage, { ramp: ramp.name, step: i });

  const reseed = (next: RampSeed) => {
    try {
      onSeed(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section
      id={`ramp-${ramp.name}`}
      className="grid scroll-mt-4 gap-3 rounded-lg border p-3"
      aria-label={`ramp ${ramp.name}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{ramp.name}</h3>
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
                {role}
              </Badge>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onRemove}
          disabled={roles.length > 0}
        >
          Remove
        </Button>
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
          return (
            <button
              key={i}
              type="button"
              aria-label={`${ramp.name} ${stopName(i)}`}
              aria-pressed={isSelected}
              title={
                tokens.length === 0
                  ? "No token lands here"
                  : tokens.map((a) => `${a.scheme} ${a.token}`).join("\n")
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
                      : "w-full"
                }
              />
              <span className="block text-center text-[10px] text-muted-foreground">
                {stopName(i)}
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
                {tokens.length > 0 ? tokens.length : " "}
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

      <details className="grid gap-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Redraw the ramp
        </summary>
        <div className="mt-2 grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={seed.kind}
              onValueChange={(v) =>
                v !== null &&
                reseed(
                  v === "hue"
                    ? {
                        kind: "hue",
                        hue: 260,
                        saturation: 0.8,
                        stops: seed.stops,
                        hueShift: seed.hueShift,
                      }
                    : {
                        kind: "through",
                        color: "#2563eb",
                        stops: seed.stops,
                        hueShift: seed.hueShift,
                      },
                )
              }
              items={{ hue: "from a hue", through: "through a color" }}
            >
              <SelectTrigger aria-label="Draw from" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hue">from a hue</SelectItem>
                <SelectItem value="through">through a color</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={seed.stops}
              onValueChange={(v) =>
                v !== null && reseed({ ...seed, stops: v as Stops })
              }
              items={{ chromatic: "chromatic stops", neutral: "neutral stops" }}
            >
              <SelectTrigger aria-label="Stops" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chromatic">chromatic stops</SelectItem>
                <SelectItem value="neutral">neutral stops</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {seed.kind === "hue" ? (
            <>
              <Field
                label="hue"
                value={seed.hue}
                min={0}
                max={360}
                step={1}
                digits={0}
                onChange={(hue) => reseed({ ...seed, hue })}
              />
              <Field
                label="sat"
                value={seed.saturation}
                min={0}
                max={1}
                step={0.01}
                digits={2}
                onChange={(saturation) => reseed({ ...seed, saturation })}
              />
            </>
          ) : (
            <div className="grid grid-cols-[3rem_1fr] items-center gap-2">
              <Label className="text-xs">color</Label>
              <Input
                aria-label="Through color"
                className="h-7 font-mono text-xs"
                value={seed.color}
                onChange={(e) => reseed({ ...seed, color: e.target.value })}
              />
            </div>
          )}
          <Field
            label="shift"
            value={seed.hueShift}
            min={-60}
            max={60}
            step={1}
            digits={0}
            onChange={(hueShift) => reseed({ ...seed, hueShift })}
          />
          {error !== null && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      </details>
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
