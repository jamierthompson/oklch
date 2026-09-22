import type { TokenAudit, TokenSetAudit } from "@jamiethompson/oklch";
import { useMemo, useState } from "react";

import { Preview } from "@/components/Preview.tsx";
import { RampEditor } from "@/components/RampEditor.tsx";
import { tokenCellId, TokensPanel } from "@/components/TokensPanel.tsx";
import { withRole, withStep, type Theme } from "@/lib/theme.ts";
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

/**
 * The palette as one page: the ramps the seeds drafted, real components
 * skinned by the tokens as they stand, and the tokens themselves, sharing
 * one selected step. A step shows the tokens that land on it; a token
 * locates the step it came from. Roles are given on the ramp that plays
 * them, and a token's ramp is its role's: the eye moves steps, not ramps.
 */
export function PalettePanel({
  theme,
  audit,
  onUpdate,
}: {
  theme: Theme;
  audit: TokenSetAudit;
  onUpdate: (b: Theme) => void;
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
            onRole={(role) => onUpdate(withRole(theme, role, ramp.name))}
            onStep={(i, s) => onUpdate(withStep(theme, ramp.name, i, s))}
          />
        ))}
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
          onUpdate={onUpdate}
        />
      </Section>
    </div>
  );
}
