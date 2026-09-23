import {
  createRamp,
  formatHex,
  HARMONY_KINDS,
  inspectRamp,
  parseColor,
  type Gamut,
  type OkLCH,
  type TokenAudit,
} from "@jamiethompson/oklch";
import { useEffect, useMemo, useState } from "react";

import { Field } from "@/components/Field.tsx";
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
import {
  isSeedsRamp,
  rampOf,
  recipeOf,
  rolesOf,
  ROLES,
  safeSeed,
  type Recipe,
  type Stops,
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

/**
 * One ramp: its roles, its steps, and the step the eye has selected, with
 * every token that lands on that step and each one's verdict on its own
 * surface. The roles are how a ramp reaches the tokens: a token's ramp is
 * its role's, so a ramp that plays nothing colors nothing. The sliders
 * move the selected step; the drawer redraws the whole ramp, by the seeds
 * or by a recipe of the eye's.
 */
export function RampEditor({
  theme,
  ramp,
  usage,
  selected,
  onSelect,
  onShowToken,
  onRole,
  onStep,
  onRedraw,
  onRemove,
}: {
  theme: Theme;
  ramp: ThemeRamp;
  usage: Usage;
  /** The selected step, when the selection is on this ramp. */
  selected: number | null;
  onSelect: (step: number) => void;
  onShowToken: (a: TokenAudit) => void;
  /** Give this ramp a role. */
  onRole: (role: Role) => void;
  onStep: (index: number, step: OkLCH) => void;
  /** Redraw this ramp by a recipe, or by the seeds again with null. Answers with a message when refused. */
  onRedraw: (recipe: Recipe | null) => string | null;
  /** Remove this ramp. Answers with a message when refused. */
  onRemove: () => string | null;
}) {
  const report = useMemo(
    () => inspectRamp(ramp.steps, theme.gamut),
    [ramp.steps, theme.gamut],
  );
  const onStepTokens = (i: number) =>
    usedBy(usage, { ramp: ramp.name, step: i });

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
          return (
            <button
              key={i}
              type="button"
              aria-label={`${ramp.name} ${stopName(i)}`}
              aria-pressed={isSelected}
              title={
                (isSeed ? "the seed, exactly\n" : "") +
                (tokens.length === 0
                  ? "No token lands here"
                  : tokens.map((a) => `${a.scheme} ${a.token}`).join("\n"))
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
            </button>
          );
        })}
      </div>

      {selected !== null && ramp.steps[selected] !== undefined && (
        <StepDetail
          theme={theme}
          ramp={ramp}
          index={selected}
          step={ramp.steps[selected]}
          inspected={report.steps[selected]!}
          tokens={onStepTokens(selected)}
          onShowToken={onShowToken}
          onStep={onStep}
        />
      )}

      <Redraw
        theme={theme}
        ramp={ramp}
        onRedraw={onRedraw}
        onRemove={onRemove}
      />
    </section>
  );
}

/** The middle step of a ramp: where a ramp drawn from a hue is most itself. */
const middle = (ramp: ThemeRamp): OkLCH =>
  ramp.steps[Math.floor(ramp.steps.length / 2)] ?? { L: 0.5, C: 0.1, H: 0 };

/** A recipe: drawn from a hue or through a color, on chromatic or neutral stops. Every change redraws. */
function RecipeEditor({
  ramp,
  recipe,
  gamut,
  onChange,
}: {
  ramp: ThemeRamp;
  recipe: Recipe;
  gamut: Gamut;
  onChange: (recipe: Recipe) => void;
}) {
  const hex = recipe.kind === "through" ? formatHex(recipe.color).hex : "";
  const [text, setText] = useState(hex);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(hex), [hex]);

  const setKind = (kind: Recipe["kind"]) => {
    if (kind === recipe.kind) return;
    if (kind === "through") {
      onChange({
        kind,
        color: safeSeed(middle(ramp), gamut),
        stops: recipe.stops,
      });
      return;
    }
    // The hue and share of the color it was drawn through, so the ramp barely moves.
    const c = recipe.kind === "through" ? recipe.color : middle(ramp);
    let saturation = 0.8;
    try {
      saturation = createRamp({ through: c, gamut }).saturation;
    } catch {
      // A color the ramp cannot be drawn through: a plain share will do.
    }
    onChange({ kind, hue: c.H, saturation, stops: recipe.stops });
  };
  const commit = () => {
    const parsed = parseColor(text.trim());
    if (parsed === null) {
      setError(`"${text.trim()}" is not a color`);
      return;
    }
    setError(null);
    onChange({ kind: "through", color: parsed, stops: recipe.stops });
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={recipe.kind}
          onValueChange={(v) => v !== null && setKind(v as Recipe["kind"])}
          items={{ hue: "from a hue", through: "through a color" }}
        >
          <SelectTrigger aria-label={`${ramp.name} drawn`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hue">from a hue</SelectItem>
            <SelectItem value="through">through a color</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={recipe.stops}
          onValueChange={(v) =>
            v !== null && onChange({ ...recipe, stops: v as Stops })
          }
          items={{ chromatic: "chromatic stops", neutral: "neutral stops" }}
        >
          <SelectTrigger aria-label={`${ramp.name} stops`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chromatic">chromatic stops</SelectItem>
            <SelectItem value="neutral">neutral stops</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {recipe.kind === "hue" ? (
        <>
          <Field
            label="hue"
            value={recipe.hue}
            min={0}
            max={360}
            step={1}
            digits={0}
            onChange={(hue) => onChange({ ...recipe, hue })}
          />
          <Field
            label="chroma"
            value={recipe.saturation}
            min={0}
            max={1}
            step={0.01}
            digits={2}
            onChange={(saturation) => onChange({ ...recipe, saturation })}
          />
        </>
      ) : (
        <div className="grid grid-cols-[3rem_1fr] items-center gap-2">
          <Label className="text-xs" htmlFor={`${ramp.name}-through`}>
            color
          </Label>
          <Input
            id={`${ramp.name}-through`}
            aria-label={`${ramp.name} through color`}
            className="h-7 font-mono text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text !== hex && commit()}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
        </div>
      )}
      {error !== null && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * How the ramp is drawn, and the way to draw it again. The primary and
 * the secondary are drawn through their seeds and go back to that;
 * the other ramps the seeds draw can be redrawn by a recipe of the eye's,
 * or handed back to the seeds; a ramp the eye added can be removed while
 * it plays no role.
 */
function Redraw({
  theme,
  ramp,
  onRedraw,
  onRemove,
}: {
  theme: Theme;
  ramp: ThemeRamp;
  onRedraw: (recipe: Recipe | null) => string | null;
  onRemove: () => string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const attempt = (f: () => string | null) => setError(f() ?? null);
  const throughSeed = ramp.name === "primary" || ramp.name === "secondary";
  const bySeeds = isSeedsRamp(ramp.name);
  const own = ramp.recipe !== undefined;
  const roles = rolesOf(theme, ramp.name);
  const status = throughSeed
    ? `Drawn through the ${ramp.name} seed. Move the seed in the rail; redrawing puts every step back where the seed draws it.`
    : !bySeeds
      ? "Added by hand. Give it a role to put it in the palette."
      : own
        ? "Drawn by hand. The seeds leave it alone."
        : "Drawn by the seeds. Change anything here and the ramp is yours; the seeds leave it alone from then on.";

  return (
    <details className="grid gap-2 text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        Redraw the ramp
      </summary>
      <div
        className="mt-2 grid gap-2"
        role="group"
        aria-label={`redraw ${ramp.name}`}
      >
        <p className="text-xs text-muted-foreground">{status}</p>
        {throughSeed ? (
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            onClick={() => attempt(() => onRedraw(null))}
          >
            Redraw from the seed
          </Button>
        ) : (
          <>
            <RecipeEditor
              ramp={ramp}
              recipe={recipeOf(theme, ramp.name)}
              gamut={theme.gamut}
              onChange={(recipe) => attempt(() => onRedraw(recipe))}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                title="Draw the ramp again by this recipe, dropping the steps you moved"
                onClick={() =>
                  attempt(() => onRedraw(recipeOf(theme, ramp.name)))
                }
              >
                Redraw
              </Button>
              {bySeeds && own && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => attempt(() => onRedraw(null))}
                >
                  Back to the seeds
                </Button>
              )}
              {!bySeeds && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={roles.length > 0}
                  title={
                    roles.length > 0
                      ? `${ramp.name} plays ${roles.join(", ")}; give ${roles.length === 1 ? "that role" : "those roles"} another ramp first`
                      : `Remove ${ramp.name}`
                  }
                  onClick={() => attempt(onRemove)}
                >
                  Remove
                </Button>
              )}
            </div>
          </>
        )}
        {error !== null && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </details>
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
  onShowToken,
  onStep,
}: {
  theme: Theme;
  ramp: ThemeRamp;
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
        of what {theme.gamut} allows
        {inspected.onCusp ? " · on the cusp" : ""}
        {inspected.map.moved
          ? ` · mapped into ${theme.gamut}, ΔE ${fixed(inspected.map.deltaEOK)}`
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
            <span className="text-muted-foreground">{howOf(theme, a)}</span>
            <Verdict a={a} />
          </div>
        ))}
      </div>
    </div>
  );
}
