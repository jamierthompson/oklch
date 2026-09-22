/**
 * The presets: the themes the studio opens on, each hand-tuned, as a
 * recipe over the formula rather than a frozen palette. The seeds, the
 * harmony, the roles, and any step the eye moved are the recipe; the ramps
 * are still drafted from the seeds, so the presets improve with the math
 * and the recipe reads as exactly what the hand did.
 *
 * Every hex is a commonly published approximation of the colors a theme
 * is named for, not an official value. Not affiliated with or endorsed by
 * the NFL.
 */

import { formatHex, parseColor, type OkLCH } from "@jamiethompson/oklch";

import {
  draftRamps,
  newTheme,
  withHarmony,
  withOverride,
  withRole,
  withSecondary,
  withStep,
  type Assignment,
  type Theme,
  type HarmonyKind,
  type Role,
} from "@/lib/theme.ts";
import { STOP_NAMES } from "@/lib/format.ts";

/** One step the eye moved off the formula's draft. */
export interface Move {
  readonly ramp: string;
  readonly step: number;
  readonly to: OkLCH;
}

export interface Preset {
  readonly id: string;
  readonly name: string;
  /** The published colors the seeds are picked from. */
  readonly colors: readonly string[];
  readonly primary: string;
  readonly secondary: string | null;
  readonly harmony: HarmonyKind;
  /** Why this preset is not the formula's. */
  readonly why: string;
  readonly roles?: Assignment;
  readonly moves?: readonly Move[];
  readonly overrides?: Theme["overrides"];
}

const t = (
  id: string,
  name: string,
  colors: readonly string[],
  primary: number,
  secondary: number | null,
  harmony: HarmonyKind,
  why: string,
): Preset => ({
  id,
  name,
  colors,
  primary: colors[primary]!,
  secondary: secondary === null ? null : colors[secondary]!,
  harmony,
  why,
});

export const PRESETS: readonly Preset[] = [
  t(
    "ari",
    "Arizona Cardinals",
    ["#97233F", "#000000", "#FFB612"],
    0,
    2,
    "split-complementary",
    "Gold is the secondary, not black: black would make every secondary surface a gray. The split-complementary of cardinal red gives teal and blue accents that stay off the gold.",
  ),
  t(
    "atl",
    "Atlanta Falcons",
    ["#A71930", "#000000", "#A5ACAF"],
    0,
    2,
    "analogous",
    "Silver is achromatic, so secondary surfaces are honest grays. Analogous keeps the accents in the red family.",
  ),
  t(
    "bal",
    "Baltimore Ravens",
    ["#241773", "#000000", "#9E7C0C"],
    0,
    2,
    "complementary",
    "The complement of the purple lands near the gold, so the accent reinforces the secondary instead of fighting it.",
  ),
  t(
    "buf",
    "Buffalo Bills",
    ["#00338D", "#C60C30"],
    0,
    1,
    "triadic",
    "Royal blue's triad puts one accent on the red the theme already owns.",
  ),
  t(
    "car",
    "Carolina Panthers",
    ["#0085CA", "#101820", "#BFC0BF"],
    0,
    1,
    "analogous",
    "The near-black secondary is achromatic. The complement of process blue is an orange the theme never uses, so analogous.",
  ),
  t(
    "chi",
    "Chicago Bears",
    ["#0B162A", "#C83803"],
    0,
    1,
    "complementary",
    "A navy primary at L 0.20 sinks into a dark surface; the dark scheme's primary must step up the ramp. The complement is the orange.",
  ),
  t(
    "cin",
    "Cincinnati Bengals",
    ["#FB4F14", "#000000"],
    0,
    1,
    "analogous",
    "Orange and black: the secondary is a true gray, so the harmony carries the color.",
  ),
  t(
    "cle",
    "Cleveland Browns",
    ["#311D00", "#FF3C00"],
    0,
    1,
    "analogous",
    "A brown primary has little chroma at L 0.25; the neighbors of its hue are the orange and a yellow.",
  ),
  t(
    "dal",
    "Dallas Cowboys",
    ["#003594", "#869397", "#041E42"],
    0,
    1,
    "analogous",
    "Silver secondary, navy tertiary dropped. Blue's neighbors keep the palette cool.",
  ),
  t(
    "den",
    "Denver Broncos",
    ["#FB4F14", "#002244"],
    0,
    1,
    "complementary",
    "Orange's complement is the navy, so accent and secondary agree.",
  ),
  t(
    "det",
    "Detroit Lions",
    ["#0076B6", "#B0B7BC"],
    0,
    1,
    "analogous",
    "Honolulu blue with a silver: the silver is achromatic and the accents stay blue.",
  ),
  t(
    "gb",
    "Green Bay Packers",
    ["#203731", "#FFB612"],
    0,
    1,
    "tetradic",
    "Tetradic is the only harmony that lands an accent on the gold from a dark green.",
  ),
  t(
    "hou",
    "Houston Texans",
    ["#03202F", "#A71930"],
    0,
    1,
    "triadic",
    "Deep steel blue's triad reaches the battle red.",
  ),
  t(
    "ind",
    "Indianapolis Colts",
    ["#002C5F", "#A2AAAD"],
    0,
    1,
    "analogous",
    "Blue and gray; the gray is achromatic, so accents stay in the blue.",
  ),
  t(
    "jax",
    "Jacksonville Jaguars",
    ["#006778", "#D7A22A", "#101820"],
    0,
    1,
    "complementary",
    "Teal's complement is a warm orange next to the gold.",
  ),
  t(
    "kc",
    "Kansas City Chiefs",
    ["#E31837", "#FFB81C"],
    0,
    1,
    "analogous",
    "Red's neighbors bridge to the gold: crimson on one side, orange on the other.",
  ),
  t(
    "lv",
    "Las Vegas Raiders",
    ["#000000", "#A5ACAF"],
    0,
    1,
    "analogous",
    "Both seeds are achromatic: there is no hue to harmonize, the neutral is a true gray, and the accent falls to the neutral. The clearest case that one formula cannot serve every theme.",
  ),
  t(
    "lac",
    "Los Angeles Chargers",
    ["#0080C6", "#FFC20E"],
    0,
    1,
    "complementary",
    "Powder blue's complement is a gold-orange beside the sunshine gold.",
  ),
  t(
    "lar",
    "Los Angeles Rams",
    ["#003594", "#FFA300", "#FFD100"],
    0,
    1,
    "complementary",
    "Royal blue's complement is the sol gold.",
  ),
  t(
    "mia",
    "Miami Dolphins",
    ["#008E97", "#FC4C02", "#005778"],
    0,
    1,
    "complementary",
    "Aqua's complement is the orange.",
  ),
  t(
    "min",
    "Minnesota Vikings",
    ["#4F2683", "#FFC62F"],
    0,
    1,
    "split-complementary",
    "The split-complementary of the purple lands one accent on the gold.",
  ),
  t(
    "ne",
    "New England Patriots",
    ["#002244", "#C60C30", "#B0B7BC"],
    0,
    1,
    "triadic",
    "Navy's triad reaches the red; the silver is dropped as a seed.",
  ),
  t(
    "no",
    "New Orleans Saints",
    ["#D3BC8D", "#101820"],
    0,
    1,
    "analogous",
    "A light old-gold primary at L 0.80: the ink on it must be dark, and the dark scheme must not lift it into cream.",
  ),
  t(
    "nyg",
    "New York Giants",
    ["#0B2265", "#A71930"],
    0,
    1,
    "triadic",
    "Blue's triad reaches the red.",
  ),
  t(
    "nyj",
    "New York Jets",
    ["#125740", "#000000", "#FFFFFF"],
    0,
    1,
    "analogous",
    "Green with black; white is never a seed. Analogous keeps the accents green.",
  ),
  t(
    "phi",
    "Philadelphia Eagles",
    ["#004C54", "#A5ACAF", "#ACC0C6"],
    0,
    1,
    "analogous",
    "Midnight green with a silver.",
  ),
  t(
    "pit",
    "Pittsburgh Steelers",
    ["#FFB612", "#101820"],
    0,
    1,
    "analogous",
    "A yellow primary at L 0.82: black ink on the primary, and the dark scheme keeps the seed rather than lifting it.",
  ),
  t(
    "sf",
    "San Francisco 49ers",
    ["#AA0000", "#B3995D"],
    0,
    1,
    "analogous",
    "Red's neighbors lean toward the gold.",
  ),
  t(
    "sea",
    "Seattle Seahawks",
    ["#002244", "#69BE28", "#A5ACAF"],
    0,
    1,
    "triadic",
    "Navy's triad lands near the action green.",
  ),
  t(
    "tb",
    "Tampa Bay Buccaneers",
    ["#D50A0A", "#FF7900", "#0A0A08"],
    0,
    1,
    "analogous",
    "Red and orange are neighbors already; analogous fills in between.",
  ),
  t(
    "ten",
    "Tennessee Titans",
    ["#0C2340", "#4B92DB", "#C8102E"],
    0,
    1,
    "analogous",
    "Navy and Titans blue are one family; the red is dropped as a seed.",
  ),
  t(
    "was",
    "Washington Commanders",
    ["#5A1414", "#FFB612"],
    0,
    1,
    "complementary",
    "Burgundy's complement is a blue that sits well against the gold.",
  ),
];

/** A theme from a preset's recipe. Throws by name when the recipe does not build. */
export function themeFromPreset(preset: Preset): Theme {
  let b: Theme = newTheme(preset.name, preset.primary, "srgb");
  if (preset.secondary !== null) {
    const s = parseColor(preset.secondary);
    if (s === null)
      throw new Error(
        `${preset.id}: secondary "${preset.secondary}" is not a color`,
      );
    b = withSecondary(b, s);
  }
  b = withHarmony(b, preset.harmony);
  for (const [role, ramp] of Object.entries(preset.roles ?? {})) {
    b = withRole(b, role as Role, ramp as string);
  }
  for (const m of preset.moves ?? []) {
    if (!b.ramps.some((r) => r.name === m.ramp)) {
      throw new Error(`${preset.id}: no ramp named "${m.ramp}" to move`);
    }
    b = withStep(b, m.ramp, m.step, m.to);
  }
  for (const scheme of ["light", "dark"] as const) {
    for (const [token, o] of Object.entries(preset.overrides?.[scheme] ?? {})) {
      b = withOverride(b, scheme, token, o);
    }
  }
  return b;
}

const same = (a: OkLCH, b: OkLCH) => a.L === b.L && a.C === b.C && a.H === b.H;
const num = (n: number, digits: number) => String(Number(n.toFixed(digits)));
const color = (c: OkLCH) =>
  `{ L: ${num(c.L, 4)}, C: ${num(c.C, 4)}, H: ${num(c.H, 2)} }`;

/**
 * The theme as a recipe: what the studio would need to build it again.
 * The steps are diffed against the formula's draft of the same seeds, so
 * only what the eye moved is written down. Paste it into `PRESETS`; a
 * theme named as a preset is written back as that preset.
 */
export function presetOf(theme: Theme): string {
  const preset = PRESETS.find((p) => p.name === theme.name);
  const id =
    preset?.id ??
    theme.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const primary = formatHex(theme.primary).hex;
  const secondary =
    theme.secondary === null ? null : formatHex(theme.secondary).hex;
  const colors = preset?.colors ?? [
    primary,
    ...(secondary === null ? [] : [secondary]),
  ];
  const draft = new Map(draftRamps(theme).map((r) => [r.name, r]));
  const moves: string[] = [];
  for (const r of theme.ramps) {
    const d = draft.get(r.name);
    r.steps.forEach((s, i) => {
      const was = d?.steps[i];
      if (was === undefined || !same(was, s)) {
        moves.push(
          `    { ramp: "${r.name}", step: ${i}, to: ${color(s)} }, // ${STOP_NAMES[i]}`,
        );
      }
    });
  }
  const q = (v: string) => JSON.stringify(v);
  const lines = [
    `{`,
    `  id: ${q(id)},`,
    `  name: ${q(theme.name)},`,
    `  colors: [${colors.map(q).join(", ")}],`,
    `  primary: ${q(primary)},`,
    `  secondary: ${secondary === null ? "null" : q(secondary)},`,
    `  harmony: ${q(theme.harmony)},`,
    `  why: ${q(preset?.why ?? "")},`,
  ];
  if (Object.keys(theme.assignment).length > 0) {
    lines.push(`  roles: ${JSON.stringify(theme.assignment)},`);
  }
  if (moves.length > 0) lines.push(`  moves: [`, ...moves, `  ],`);
  const overrides = theme.overrides;
  if (
    Object.keys(overrides.light).length > 0 ||
    Object.keys(overrides.dark).length > 0
  ) {
    lines.push(`  overrides: ${JSON.stringify(overrides)},`);
  }
  lines.push(`}`);
  return lines.join("\n");
}
