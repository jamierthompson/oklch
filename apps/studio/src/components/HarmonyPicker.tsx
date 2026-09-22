import { HARMONY_KINDS, type HarmonyKind } from "@jamiethompson/oklch";

import { HARMONY_LABELS } from "@/lib/theme.ts";

const R = 9;
const C = 12;

/** Where a hue sits on the wheel glyph, counter-clockwise from three o'clock like OKLCH's own hue angle. */
function at(degrees: number): { x: number; y: number } {
  const rad = (degrees * Math.PI) / 180;
  return { x: C + R * Math.cos(rad), y: C - R * Math.sin(rad) };
}

/** The hue at a wheel position, as a swatch: mid lightness, enough chroma to read. */
const swatch = (hue: number) => `oklch(0.7 0.15 ${hue.toFixed(1)})`;

/**
 * One harmony as a glyph: the wheel, the seed on it, and a dot at every
 * offset. With a hue, the dots sit where the hues really are and take
 * their color; without one, the seed sits at the top.
 */
export function HarmonyGlyph({
  kind,
  hue,
}: {
  kind: HarmonyKind;
  hue: number | null;
}) {
  const seed = hue ?? 90;
  const points = HARMONY_KINDS[kind].map((offset) => ({
    offset,
    ...at(seed + offset),
  }));
  const origin = at(seed);
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden
      className="shrink-0"
    >
      <circle
        cx={C}
        cy={C}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
      />
      {points.map((p) => (
        <line
          key={p.offset}
          x1={origin.x}
          y1={origin.y}
          x2={p.x}
          y2={p.y}
          stroke="currentColor"
          strokeOpacity="0.3"
        />
      ))}
      {points.map((p) => (
        <circle
          key={p.offset}
          cx={p.x}
          cy={p.y}
          r="2.4"
          fill={hue === null ? "currentColor" : swatch(seed + p.offset)}
          fillOpacity={hue === null ? 0.5 : 1}
        />
      ))}
      <circle
        cx={origin.x}
        cy={origin.y}
        r="3"
        fill={hue === null ? "currentColor" : swatch(seed)}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

const degrees = (kind: HarmonyKind) =>
  HARMONY_KINDS[kind].map((d) => `${d > 0 ? "+" : ""}${d}°`).join(", ");

/**
 * Which hues of the seed's are drawn as ramps of their own: one button per
 * harmony, each with its glyph, and the chosen one's offsets and what it
 * is for underneath.
 */
export function HarmonyPicker({
  value,
  hue,
  onChange,
}: {
  value: HarmonyKind;
  /** The hue the harmonies rotate from, or null when the seeds have none. */
  hue: number | null;
  onChange: (kind: HarmonyKind) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="grid gap-1" role="group" aria-label="Harmony">
        {(Object.keys(HARMONY_KINDS) as HarmonyKind[]).map((kind) => {
          const on = kind === value;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              onClick={() => !on && onChange(kind)}
              className={
                "flex items-center gap-2 rounded-md border px-2 py-1 text-left text-xs " +
                (on
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <HarmonyGlyph kind={kind} hue={hue} />
              <span className="font-medium">{HARMONY_LABELS[kind].name}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        <span className="font-mono">{degrees(value)}</span>
        {hue === null ? " · no hue to rotate from" : ""}
        <br />
        {HARMONY_LABELS[value].description}
      </p>
    </div>
  );
}
