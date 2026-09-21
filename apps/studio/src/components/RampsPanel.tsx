import { useState } from "react";

import { RampEditor } from "@/components/RampEditor.tsx";
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
import {
  withoutRamp,
  withRamp,
  withSeed,
  withStep,
  type Brand,
  type ShadcnRole,
} from "@/lib/brand.ts";

const ROLES: readonly ShadcnRole[] = [
  "neutral",
  "primary",
  "destructive",
  "secondary",
  "accent",
];

export function RampsPanel({
  brand,
  onUpdate,
}: {
  brand: Brand;
  onUpdate: (b: Brand) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const attempt = (f: () => Brand) => {
    try {
      onUpdate(f());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const names = Object.fromEntries(brand.ramps.map((r) => [r.name, r.name]));

  return (
    <div className="grid gap-4">
      <section className="grid gap-2 rounded-lg border p-3" aria-label="roles">
        <h3 className="font-medium">Which ramp plays which role</h3>
        <div className="flex flex-wrap gap-3">
          {ROLES.map((role) => {
            const value = brand.assignment[role] ?? brand.assignment.neutral;
            return (
              <div key={role} className="grid gap-1">
                <Label className="text-xs">{role}</Label>
                <Select
                  value={value}
                  onValueChange={(v) =>
                    v !== null &&
                    onUpdate({
                      ...brand,
                      assignment: { ...brand.assignment, [role]: v },
                    })
                  }
                  items={names}
                >
                  <SelectTrigger aria-label={`${role} ramp`} className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {brand.ramps.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </section>

      {brand.ramps.map((ramp) => (
        <RampEditor
          key={ramp.name}
          brand={brand}
          ramp={ramp}
          onSeed={(seed) => onUpdate(withSeed(brand, ramp.name, seed))}
          onStep={(i, s) => onUpdate(withStep(brand, ramp.name, i, s))}
          onRemove={() => attempt(() => withoutRamp(brand, ramp.name))}
        />
      ))}

      <section
        className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
        aria-label="add ramp"
      >
        <div className="grid gap-1">
          <Label htmlFor="ramp-name">Add a ramp</Label>
          <Input
            id="ramp-name"
            className="w-40"
            placeholder="name, e.g. teal"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            attempt(() => {
              const b = withRamp(brand, name.trim(), {
                kind: "hue",
                hue: 180,
                saturation: 0.7,
                stops: "chromatic",
                hueShift: 0,
              });
              setName("");
              return b;
            })
          }
        >
          Draw
        </Button>
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
  );
}
