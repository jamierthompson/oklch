import {
  HARMONY_KINDS,
  inspectRamp,
  type OkLCH,
  type TokenAudit,
} from "@jamiethompson/oklch";
import { RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { Field } from "@/components/Field.tsx";
import { Swatch } from "@/components/Swatch.tsx";
import { Verdict } from "@/components/Verdict.tsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  draftRamps,
  rampOf,
  ROLES,
  type Theme,
  type ThemeRamp,
  type Role,
} from "@/lib/theme.ts";
import { fixed, stopName } from "@/lib/format.ts";
import { usedBy, type Usage } from "@/lib/usage.ts";

/** How a token came to sit on this step. */
function howOf(theme: Theme, a: TokenAudit): "override" | "solved" | "picked" {
  if (theme.overrides[a.scheme][a.token] !== undefined) return "override";
  return a.outcome.kind !== "unresolved" && a.outcome.resolved.how === "solved"
    ? "solved"
    : "picked";
}

/** What drew this ramp: the seed's hue, or the offset from it. */
function subtitleOf(theme: Theme, ramp: ThemeRamp): string {
  const hue = `H ${fixed(ramp.steps[5]?.H ?? 0, 1)}°`;
  const n = ramp.name.match(/^harmony-(\d+)$/);
  if (n === null) return hue;
  const offset = HARMONY_KINDS[theme.harmony][Number(n[1]) - 1] ?? 0;
  return `${offset > 0 ? "+" : ""}${offset}° → ${hue}`;
}

/** The id of a step's button, which the popover anchors to. */
const stepId = (ramp: string, index: number) => `ramp-${ramp}-step-${index}`;

const sameColor = (a: OkLCH, b: OkLCH) =>
  a.L === b.L && a.C === b.C && a.H === b.H;

/**
 * The ramp as the seeds draft it now, for a step to reset to. Null for a
 * ramp the seeds can no longer draw.
 */
function draftOf(theme: Theme, ramp: ThemeRamp): ThemeRamp | null {
  try {
    return draftRamps(theme).find((r) => r.name === ramp.name) ?? null;
  } catch {
    return null;
  }
}

/** A round-arrow icon button: put something back where it was drawn. */
function ResetButton({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="-mt-1 -mr-1"
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <RotateCcw />
    </Button>
  );
}

/**
 * One ramp: its roles, its steps, and a popover. Every step is a trigger
 * for the popover, which holds the selected step's sliders and the tokens
 * that land on it with each one's verdict. The roles are how a ramp
 * reaches the tokens: a token's ramp is its role's, so a ramp that plays
 * nothing colors nothing.
 */
export function RampEditor({
  theme,
  ramp,
  usage,
  selected,
  open,
  onSelect,
  onClose,
  onShowToken,
  onRole,
  onStep,
}: {
  theme: Theme;
  ramp: ThemeRamp;
  usage: Usage;
  /** The selected step, when the selection is on this ramp. */
  selected: number | null;
  /** Whether the selected step's popover is open. */
  open: boolean;
  /** Select a step and open its popover. */
  onSelect: (step: number) => void;
  /** The popover closed; the selection stays. */
  onClose: () => void;
  onShowToken: (a: TokenAudit) => void;
  /** Give this ramp a role. */
  onRole: (role: Role) => void;
  onStep: (index: number, step: OkLCH) => void;
}) {
  const report = useMemo(
    () => inspectRamp(ramp.steps, theme.gamut),
    [ramp.steps, theme.gamut],
  );
  const draft = useMemo(() => draftOf(theme, ramp), [theme, ramp]);
  const onStepTokens = (i: number) =>
    usedBy(usage, { ramp: ramp.name, step: i });
  const step = selected === null ? undefined : ramp.steps[selected];
  const isOpen = open && step !== undefined;

  return (
    <section
      id={`ramp-${ramp.name}`}
      className="grid scroll-mt-4 gap-3 rounded-lg border p-3"
      aria-label={`ramp ${ramp.name}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{ramp.name}</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {subtitleOf(theme, ramp)}
        </span>
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label={`${ramp.name} roles`}
        >
          {ROLES.map((role) => {
            const plays = rampOf(theme, role) === ramp.name;
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

      <Popover
        open={isOpen}
        triggerId={selected === null ? null : stepId(ramp.name, selected)}
        onOpenChange={(next, details) => {
          if (!next) {
            onClose();
            return;
          }
          // Pressing any step, even while open, brings the popover to it.
          const id = details.trigger?.id;
          const index = ramp.steps.findIndex(
            (_, i) => stepId(ramp.name, i) === id,
          );
          onSelect(index === -1 ? (selected ?? 0) : index);
        }}
      >
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
            // A seed step the eye moved off the seed: still where the seed lands, no longer its color.
            const offSeed =
              isSeed &&
              draft !== null &&
              draft.steps[i] !== undefined &&
              !sameColor(s, draft.steps[i]);
            return (
              <PopoverTrigger
                key={i}
                id={stepId(ramp.name, i)}
                aria-label={`${ramp.name} ${stopName(i)}`}
                aria-pressed={isSelected}
                title={
                  (offSeed
                    ? "drawn through the seed, then moved\n"
                    : isSeed
                      ? "the seed, exactly\n"
                      : "") +
                  (tokens.length === 0
                    ? "No token lands here"
                    : tokens.map((a) => `${a.scheme} ${a.token}`).join("\n"))
                }
                className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Swatch
                  color={s}
                  className={
                    isSelected
                      ? "w-full ring-2 ring-ring ring-offset-2 ring-offset-background"
                      : failing
                        ? "w-full ring-2 ring-destructive ring-offset-1 ring-offset-background"
                        : offSeed
                          ? "w-full outline-2 outline-offset-1 outline-foreground outline-dashed"
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
              </PopoverTrigger>
            );
          })}
        </div>

        {selected !== null && step !== undefined && (
          <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] max-h-(--available-height) overflow-y-auto">
            <StepDetail
              theme={theme}
              ramp={ramp}
              index={selected}
              step={step}
              inspected={report.steps[selected]!}
              tokens={onStepTokens(selected)}
              draft={draft?.steps[selected] ?? null}
              onShowToken={onShowToken}
              onStep={onStep}
            />
          </PopoverContent>
        )}
      </Popover>
    </section>
  );
}

/** The selected step: what it measures, the sliders that move it, and the tokens that land on it. */
function StepDetail({
  theme,
  ramp,
  index,
  step,
  inspected,
  tokens,
  draft,
  onShowToken,
  onStep,
}: {
  theme: Theme;
  ramp: ThemeRamp;
  index: number;
  step: OkLCH;
  inspected: ReturnType<typeof inspectRamp>["steps"][number];
  tokens: readonly TokenAudit[];
  /** Where the seeds draft this step, to reset to; null when they cannot draw it. */
  draft: OkLCH | null;
  onShowToken: (a: TokenAudit) => void;
  onStep: (index: number, step: OkLCH) => void;
}) {
  const moved = draft !== null && !sameColor(step, draft);
  return (
    <div className="grid gap-2">
      <PopoverHeader>
        <div className="flex items-start justify-between gap-2">
          <PopoverTitle>
            {ramp.name} {stopName(index)}
          </PopoverTitle>
          <ResetButton
            label={`reset ${ramp.name} ${stopName(index)}`}
            title={
              moved
                ? "Put this step back where the seeds draft it"
                : "This step sits where the seeds draft it"
            }
            disabled={!moved}
            onClick={() => draft !== null && onStep(index, draft)}
          />
        </div>
        <PopoverDescription className="text-xs">
          chroma {fixed(inspected.chromaShare * 100, 0)}% of what {theme.gamut}{" "}
          allows
          {inspected.onCusp ? " · on the cusp" : ""}
          {inspected.map.moved
            ? ` · mapped into ${theme.gamut}, ΔE ${fixed(inspected.map.deltaEOK)}`
            : ""}
        </PopoverDescription>
      </PopoverHeader>
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
            <Button
              variant="link"
              size="xs"
              className="h-auto px-0 font-mono text-xs"
              title="Show this token in the table"
              onClick={() => onShowToken(a)}
            >
              {a.scheme} · {a.token}
            </Button>
            <span className="text-muted-foreground">{howOf(theme, a)}</span>
            <Verdict a={a} />
          </div>
        ))}
      </div>
    </div>
  );
}
