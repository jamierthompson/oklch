import {
  formatHex,
  formatOklch,
  parseColor,
  type OkLCH,
} from "@jamiethompson/oklch";
import { useEffect, useState } from "react";

import { Field } from "@/components/Field.tsx";
import { HarmonyPicker } from "@/components/HarmonyPicker.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  hueSourceOf,
  isChromatic,
  safeSeed,
  SEED_L,
  type Theme,
  type HarmonyKind,
} from "@/lib/theme.ts";

const L_MIN = SEED_L.min;
const L_MAX = SEED_L.max;
/** Below this many degrees apart, two seeds read as tints of one hue. */
const CLOSE_HUES = 20;

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2 border-b py-3 last:border-b-0">
      <h3 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * One seed: its swatch, the color as hex, and its three channels. Typing a
 * color replaces the seed; a slider moves one channel and keeps the seed
 * within the safe chroma, so the ramp through it can always be drawn.
 */
function SeedEditor({
  label,
  color,
  gamut,
  onChange,
}: {
  label: string;
  color: OkLCH;
  gamut: Theme["gamut"];
  onChange: (c: OkLCH) => string | null;
}) {
  const hex = formatHex(color).hex;
  const [text, setText] = useState(hex);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(hex), [hex]);

  const commit = () => {
    const parsed = parseColor(text.trim());
    if (parsed === null) {
      setError(`"${text.trim()}" is not a color`);
      return;
    }
    setError(onChange(parsed));
  };
  const move = (next: OkLCH) => setError(onChange(safeSeed(next, gamut)));

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[2.75rem_1fr] items-start gap-2">
        <span
          aria-hidden
          className="block size-11 rounded-md border"
          style={{ background: formatOklch(color) }}
        />
        <Input
          aria-label={`${label} color`}
          className="h-8 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== hex && commit()}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      </div>
      <Field
        label="L"
        value={color.L}
        min={L_MIN}
        max={L_MAX}
        step={0.001}
        onChange={(L) => move({ ...color, L })}
      />
      <Field
        label="C"
        value={color.C}
        min={0}
        max={0.37}
        step={0.001}
        onChange={(C) => move({ ...color, C })}
      />
      <Field
        label="H"
        value={color.H}
        min={0}
        max={360}
        step={0.1}
        digits={1}
        onChange={(H) => move({ ...color, H })}
      />
      {error !== null && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** What the seeds imply that the eye should know. */
function notesOf(theme: Theme): string[] {
  const notes: string[] = [];
  const { primary, secondary } = theme;
  if (!isChromatic(primary)) {
    notes.push(
      secondary !== null && isChromatic(secondary)
        ? "The primary has no hue (C < 0.03), so the neutral's tint and the harmonies take the secondary's hue instead."
        : "The primary has no hue (C < 0.03), so the neutral is a true gray and there are no harmony ramps. A chromatic secondary would give them a hue.",
    );
  }
  if (secondary !== null && !isChromatic(secondary)) {
    notes.push(
      "The secondary has no hue: its ramp is a true gray, so secondary surfaces read as neutral. Faithful to the theme, not a bug.",
    );
  }
  if (secondary !== null && isChromatic(primary) && isChromatic(secondary)) {
    const d = Math.abs(((primary.H - secondary.H + 540) % 360) - 180);
    if (d < CLOSE_HUES) {
      notes.push(
        `The primary and secondary hues are ${d.toFixed(0)}° apart, so secondary surfaces will read as tints of the primary.`,
      );
    }
  }
  return notes;
}

/** The primary ramp as it stands, live, so a seed can be dragged with its effect in view even from a drawer. */
function Strip({ theme }: { theme: Theme }) {
  const primary = theme.ramps.find((r) => r.name === "primary");
  if (primary === undefined) return null;
  return (
    <div
      className="flex gap-px overflow-hidden rounded-md border"
      aria-label="primary ramp"
      role="img"
    >
      {primary.steps.map((s, i) => (
        <span
          key={i}
          className="h-4 flex-1"
          style={{ background: formatOklch(s) }}
        />
      ))}
    </div>
  );
}

/**
 * The rail: the two seeds and the harmony the ramps are drafted from.
 * Every change here redraws the ramps it touches and leaves the eye's
 * steps on the others; the ramps themselves are edited in the palette.
 * Each callback answers with a message when the change is refused.
 */
export function SeedRail({
  theme,
  onPrimary,
  onSecondary,
  onHarmony,
  className = "",
}: {
  theme: Theme;
  onPrimary: (c: OkLCH) => string | null;
  onSecondary: (c: OkLCH | null) => string | null;
  onHarmony: (k: HarmonyKind) => string | null;
  className?: string;
}) {
  const [secondaryText, setSecondaryText] = useState("");
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const addSecondary = () => {
    const parsed = parseColor(secondaryText.trim());
    if (parsed === null) {
      setSecondaryError(`"${secondaryText.trim()}" is not a color`);
      return;
    }
    const error = onSecondary(parsed);
    setSecondaryError(error);
    if (error === null) setSecondaryText("");
  };
  const source = hueSourceOf(theme.primary, theme.secondary);
  const notes = notesOf(theme);

  return (
    <aside className={`grid content-start ${className}`} aria-label="Seeds">
      <div className="pt-3">
        <Strip theme={theme} />
      </div>
      <Group title="Primary seed">
        <SeedEditor
          label="Primary"
          color={theme.primary}
          gamut={theme.gamut}
          onChange={onPrimary}
        />
      </Group>

      <Group title="Secondary seed">
        {theme.secondary === null ? (
          <div className="grid gap-2">
            <div className="flex gap-2">
              <Input
                aria-label="Secondary color"
                className="h-8 font-mono text-xs"
                placeholder="#f59e0b or oklch(…)"
                value={secondaryText}
                onChange={(e) => setSecondaryText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSecondary()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={addSecondary}
                disabled={secondaryText.trim() === ""}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. Without one, secondary surfaces come from the neutral.
            </p>
            {secondaryError !== null && (
              <p className="text-xs text-destructive">{secondaryError}</p>
            )}
          </div>
        ) : (
          <>
            <SeedEditor
              label="Secondary"
              color={theme.secondary}
              gamut={theme.gamut}
              onChange={onSecondary}
            />
            <Button
              size="sm"
              variant="ghost"
              className="justify-self-start"
              onClick={() => onSecondary(null)}
            >
              Remove secondary
            </Button>
          </>
        )}
      </Group>

      <Group
        title={
          source === theme.primary || source === null
            ? "Harmony of the primary hue"
            : "Harmony of the secondary hue"
        }
      >
        <HarmonyPicker
          value={theme.harmony}
          hue={source?.H ?? null}
          onChange={(kind) => onHarmony(kind)}
        />
      </Group>

      {notes.length > 0 && (
        <Group title="Notes">
          {notes.map((n) => (
            <p
              key={n}
              className="rounded-r-md border-l-2 border-amber-500 bg-muted px-2.5 py-2 text-xs"
            >
              {n}
            </p>
          ))}
        </Group>
      )}
    </aside>
  );
}
