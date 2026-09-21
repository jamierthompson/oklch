import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEEDS } from "@/lib/seeds.ts";

/**
 * A few colors to try, and a field for the one you already have. Picking
 * one is the action: `onPick` returns a message when the color is refused.
 */
export function SeedPicker({
  onPick,
  compact = false,
  current,
}: {
  onPick: (color: string) => string | null;
  compact?: boolean;
  /** The color the current draft was drawn through, to mark the seed it came from. */
  current?: string | undefined;
}) {
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pick = (color: string) => setError(onPick(color));
  const tryCustom = () => {
    if (custom.trim() !== "") pick(custom.trim());
  };
  const isCurrent = (color: string) =>
    current !== undefined && current.toLowerCase() === color.toLowerCase();

  return (
    <div
      className={cn(
        "grid gap-3",
        compact && "flex flex-wrap items-center gap-2",
      )}
    >
      <div
        className={cn("flex flex-wrap gap-2", compact && "gap-1")}
        role="group"
        aria-label="Seed colors"
      >
        {SEEDS.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-label={s.name}
            aria-pressed={isCurrent(s.color)}
            title={compact ? `Try ${s.name}` : undefined}
            onClick={() => pick(s.color)}
            className={cn(
              "grid justify-items-center gap-1 rounded-md text-xs text-muted-foreground hover:text-foreground",
              compact ? "p-0.5" : "p-1",
            )}
          >
            <span
              className={cn(
                "block rounded-md border",
                compact ? "size-6 rounded-full" : "size-12",
                isCurrent(s.color) &&
                  "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
              style={{ background: s.color }}
            />
            {!compact && s.name}
          </button>
        ))}
      </div>
      <div className={cn("grid gap-1", compact && "flex items-center gap-2")}>
        {!compact && <Label htmlFor="seed-color">Or your own color</Label>}
        <Input
          id="seed-color"
          aria-label={compact ? "Your own color" : undefined}
          className={cn("font-mono", compact ? "h-8 w-40 text-xs" : "w-56")}
          placeholder="#2563eb or oklch(…)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryCustom()}
        />
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={tryCustom}
          disabled={custom.trim() === ""}
          className={cn(!compact && "w-fit")}
        >
          Try
        </Button>
      </div>
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
