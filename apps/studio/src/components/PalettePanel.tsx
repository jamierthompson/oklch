import {
  parseColor,
  type OkLCH,
  type TokenAudit,
  type TokenSetAudit,
} from "@jamiethompson/oklch";
import { useMemo, useState } from "react";

import { Preview } from "@/components/Preview.tsx";
import { RampEditor } from "@/components/RampEditor.tsx";
import { tokenCellId, TokensPanel } from "@/components/TokensPanel.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Theme, Override, Recipe, Role, Scheme } from "@/lib/theme.ts";
import { usageOf, type StepRef } from "@/lib/usage.ts";

/** The step selected when nothing has been: the primary's seed step, else its middle. */
const DEFAULT_STEP = 5;

function scrollTo(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3" aria-label={title.toLowerCase()}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A new ramp: a name and the color it is drawn through. The ramp's drawer takes it from there. */
function AddRamp({
  onAdd,
}: {
  onAdd: (name: string, recipe: Recipe) => string | null;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const draw = () => {
    const parsed = parseColor(color.trim());
    if (parsed === null) {
      setError(`"${color.trim()}" is not a color`);
      return;
    }
    const refused =
      onAdd(name.trim(), {
        kind: "through",
        color: parsed,
        stops: "chromatic",
      }) ?? null;
    setError(refused);
    if (refused === null) {
      setName("");
      setColor("");
    }
  };
  const ready = name.trim() !== "" && color.trim() !== "";
  return (
    <section
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3"
      aria-label="add ramp"
    >
      <div className="grid gap-1">
        <Label htmlFor="ramp-name">Add a ramp</Label>
        <Input
          id="ramp-name"
          className="h-8 w-40"
          placeholder="name, e.g. teal"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ready && draw()}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="ramp-color">Through a color</Label>
        <Input
          id="ramp-color"
          className="h-8 w-44 font-mono text-xs"
          placeholder="#14b8a6 or oklch(…)"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ready && draw()}
        />
      </div>
      <Button variant="outline" disabled={!ready} onClick={draw}>
        Draw
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Drawn through the color on chromatic stops; the ramp's drawer can redraw
        it from a hue or on neutral stops. Give it a role to put it in the
        palette.
      </p>
      {error !== null && (
        <p className="w-full text-xs text-destructive">{error}</p>
      )}
    </section>
  );
}

/**
 * The palette as one page: the ramps the seeds drew and the eye added,
 * real components skinned by the tokens as they stand, and the tokens
 * themselves, sharing one selected step. A step shows the tokens that
 * land on it; a token locates the step it came from. Roles are given on
 * the ramp that plays them, and a token's ramp is its role's: the eye
 * moves steps, not ramps.
 */
export interface PaletteActions {
  onStep: (ramp: string, index: number, step: OkLCH) => void;
  onRole: (role: Role, ramp: string) => void;
  /** Redraw a ramp by a recipe, or by the seeds again with null. Answers with a message when refused. */
  onRedraw: (ramp: string, recipe: Recipe | null) => string | null;
  onAddRamp: (name: string, recipe: Recipe) => string | null;
  onRemoveRamp: (ramp: string) => string | null;
  onOverride: (
    scheme: Scheme,
    token: string,
    override: Override | null,
  ) => void;
}

export function PalettePanel({
  theme,
  audit,
  actions,
}: {
  theme: Theme;
  audit: TokenSetAudit;
  actions: PaletteActions;
}) {
  const [selected, setSelected] = useState<StepRef | null>(null);
  const usage = useMemo(() => usageOf(audit), [audit]);

  // A selection that names a ramp the theme no longer has falls back.
  const primary = theme.ramps.find((r) => r.name === "primary");
  const selection: StepRef | null =
    selected !== null && theme.ramps.some((r) => r.name === selected.ramp)
      ? selected
      : primary === undefined
        ? null
        : { ramp: primary.name, step: primary.seed ?? DEFAULT_STEP };

  const locate = (ref: StepRef) => {
    setSelected(ref);
    scrollTo(`ramp-${ref.ramp}`);
  };
  const showToken = (a: TokenAudit) => scrollTo(tokenCellId(a.scheme, a.token));
  const failing = [...audit.light, ...audit.dark].filter(
    (a) => a.outcome.kind !== "clears",
  ).length;

  return (
    <div className="grid gap-8">
      <Section
        title="Ramps"
        aside={
          <p className="text-xs text-muted-foreground">
            The outlined step is the seed, exactly. Select a step to move it; a
            red ring marks a step with a token that does not clear.
          </p>
        }
      >
        {theme.ramps.map((ramp) => (
          <RampEditor
            key={ramp.name}
            theme={theme}
            ramp={ramp}
            usage={usage}
            selected={selection?.ramp === ramp.name ? selection.step : null}
            onSelect={(step) => setSelected({ ramp: ramp.name, step })}
            onShowToken={showToken}
            onRole={(role) => actions.onRole(role, ramp.name)}
            onStep={(i, s) => actions.onStep(ramp.name, i, s)}
            onRedraw={(recipe) => actions.onRedraw(ramp.name, recipe)}
            onRemove={() => actions.onRemoveRamp(ramp.name)}
          />
        ))}
        <AddRamp onAdd={actions.onAddRamp} />
      </Section>

      <Section
        title="Preview"
        aside={
          <p className="text-xs text-muted-foreground">
            Real shadcn components, both schemes, read from the tokens as they
            stand. Nothing here is hand-tuned.
          </p>
        }
      >
        <div className="grid gap-4 2xl:grid-cols-2">
          <Preview theme={theme} audit={audit} scheme="light" />
          <Preview theme={theme} audit={audit} scheme="dark" />
        </div>
      </Section>

      <Section
        title="Tokens"
        aside={
          <p className="text-xs text-muted-foreground">
            Every shadcn variable, in both schemes, on the ramp its role plays.
            A swatch shows the step it came from; the highlighted cells sit on
            the selected step.
            {failing > 0 ? ` ${failing} do not clear.` : ""}
          </p>
        }
      >
        <TokensPanel
          theme={theme}
          audit={audit}
          selection={selection}
          onLocate={locate}
          onOverride={actions.onOverride}
        />
      </Section>
    </div>
  );
}
