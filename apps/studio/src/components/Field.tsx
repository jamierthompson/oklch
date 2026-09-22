import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { fixed } from "@/lib/format.ts";

/** One channel: a label, a slider, and the number it stands at. */
export function Field({
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
