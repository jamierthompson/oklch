import { inspectRamp, type OkLCH } from "@jamiethompson/oklch";
import { useMemo, useState } from "react";

import { Swatch } from "@/components/Swatch.tsx";
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
  Stops,
} from "@jamiethompson/oklch-brand";
import { fixed, stopName } from "@/lib/format.ts";

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

export function RampEditor({
  brand,
  ramp,
  onSeed,
  onStep,
  onRemove,
}: {
  brand: Brand;
  ramp: BrandRamp;
  onSeed: (seed: RampSeed) => void;
  onStep: (index: number, step: OkLCH) => void;
  onRemove: () => void;
}) {
  const [selected, setSelected] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const report = useMemo(
    () => inspectRamp(ramp.steps, brand.gamut),
    [ramp.steps, brand.gamut],
  );
  const step = ramp.steps[selected] ?? ramp.steps[0]!;
  const inspected = report.steps[selected] ?? report.steps[0]!;
  const seed = ramp.seed;

  const reseed = (next: RampSeed) => {
    try {
      onSeed(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const roles = Object.entries(brand.assignment)
    .filter(([role, v]) => role !== "charts" && v === ramp.name)
    .map(([role]) => role);

  return (
    <section
      className="grid gap-3 rounded-lg border p-3"
      aria-label={`ramp ${ramp.name}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">
          {ramp.name}
          {roles.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {roles.join(", ")}
            </span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
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
        {ramp.steps.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${ramp.name} ${stopName(i)}`}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            className="flex-1"
          >
            <Swatch
              color={s}
              className={
                i === selected
                  ? "w-full ring-2 ring-ring ring-offset-2"
                  : "w-full"
              }
            />
            <span className="block text-center text-[10px] text-muted-foreground">
              {stopName(i)}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="text-xs text-muted-foreground">
          step {stopName(selected)} · chroma{" "}
          {fixed(inspected.chromaShare * 100, 0)}% of what {brand.gamut} allows
          {inspected.onCusp ? " · on the cusp" : ""}
          {inspected.map.moved
            ? ` · mapped into ${brand.gamut}, ΔE ${fixed(inspected.map.deltaEOK)}`
            : ""}
          {" · on white "}WCAG {fixed(inspected.contrast.onWhite.wcag, 2)} · on
          black {fixed(inspected.contrast.onBlack.wcag, 2)}
        </div>
        <Field
          label="L"
          value={step.L}
          min={0}
          max={1}
          step={0.001}
          onChange={(L) => onStep(selected, { ...step, L })}
        />
        <Field
          label="C"
          value={step.C}
          min={0}
          max={0.4}
          step={0.001}
          onChange={(C) => onStep(selected, { ...step, C })}
        />
        <Field
          label="H"
          value={step.H}
          min={0}
          max={360}
          step={0.1}
          digits={1}
          onChange={(H) => onStep(selected, { ...step, H })}
        />
      </div>

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
