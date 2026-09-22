import type { TokenAudit, TokenSetAudit } from "@jamiethompson/oklch";
import { useMemo, useState } from "react";

import { RampEditor } from "@/components/RampEditor.tsx";
import { tokenCellId, TokensPanel } from "@/components/TokensPanel.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  withoutRamp,
  withRamp,
  withRole,
  withSeed,
  withStep,
  type Brand,
} from "@/lib/brand.ts";
import { usageOf, type StepRef } from "@/lib/usage.ts";

/** The step selected when nothing has been: the first ramp's middle. */
const DEFAULT_STEP = 5;

function scrollTo(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

/**
 * The palette as one view: the ramps and the tokens bound to them, sharing
 * one selected step. A step shows the tokens that land on it; a token
 * locates the step it came from. Roles are given on the ramp that plays
 * them, and a token's ramp is its role's: the eye moves steps, not ramps.
 */
export function PalettePanel({
  brand,
  audit,
  onUpdate,
}: {
  brand: Brand;
  audit: TokenSetAudit;
  onUpdate: (b: Brand) => void;
}) {
  const [selected, setSelected] = useState<StepRef | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const usage = useMemo(() => usageOf(audit), [audit]);

  // A selection that names a ramp the brand no longer has falls back.
  const first = brand.ramps[0]?.name;
  const selection: StepRef | null =
    selected !== null && brand.ramps.some((r) => r.name === selected.ramp)
      ? selected
      : first === undefined
        ? null
        : { ramp: first, step: DEFAULT_STEP };

  const attempt = (f: () => Brand) => {
    try {
      onUpdate(f());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const locate = (ref: StepRef) => {
    setSelected(ref);
    scrollTo(`ramp-${ref.ramp}`);
  };
  const showToken = (a: TokenAudit) => scrollTo(tokenCellId(a.scheme, a.token));

  return (
    <div className="grid gap-4">
      {brand.ramps.map((ramp) => (
        <RampEditor
          key={ramp.name}
          brand={brand}
          ramp={ramp}
          usage={usage}
          selected={selection?.ramp === ramp.name ? selection.step : null}
          onSelect={(step) => setSelected({ ramp: ramp.name, step })}
          onShowToken={showToken}
          onRole={(role) => onUpdate(withRole(brand, role, ramp.name))}
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

      <section className="grid gap-2" aria-label="tokens">
        <h3 className="font-medium">Tokens</h3>
        <p className="text-xs text-muted-foreground">
          Every shadcn variable, in both schemes, on the ramp its role plays. A
          swatch shows the step it came from; the highlighted cells sit on the
          selected step.
        </p>
        <TokensPanel
          brand={brand}
          audit={audit}
          selection={selection}
          onLocate={locate}
          onUpdate={onUpdate}
        />
      </section>
    </div>
  );
}
