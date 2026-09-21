import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEEDS } from "@/lib/seeds.ts";

/** A few colors to start from, and a field for the one you already have. */
export function SeedPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Seed colors"
      >
        {SEEDS.map((s) => {
          const selected = s.color.toLowerCase() === value.trim().toLowerCase();
          return (
            <button
              key={s.name}
              type="button"
              aria-label={s.name}
              aria-pressed={selected}
              onClick={() => onChange(s.color)}
              className={cn(
                "grid justify-items-center gap-1 rounded-md p-1 text-xs text-muted-foreground",
                selected && "text-foreground",
              )}
            >
              <span
                className={cn(
                  "block size-12 rounded-md border",
                  selected &&
                    "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
                style={{ background: s.color }}
              />
              {s.name}
            </button>
          );
        })}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="seed-color">Or your own color</Label>
        <Input
          id="seed-color"
          className="w-48 font-mono"
          placeholder="#2563eb or oklch(…)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
