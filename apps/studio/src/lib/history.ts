/**
 * Everything that happens to the themes is a command with its inverse
 * attached, kept in one log. The log is the undo stack, as in Photoshop's
 * History panel: undo steps back one entry; undoing to an older entry
 * steps back through everything after it too, and those entries stay,
 * greyed, until a new action truncates them. Nothing here signs off on a
 * palette; it only makes every move reversible.
 */

import { formatHex, type Gamut, type OkLCH } from "@jamiethompson/oklch";

import {
  HARMONY_LABELS,
  withGamut,
  withOverride,
  withStep,
  type Theme,
  type ThemeRamp,
  type HarmonyKind,
  type Override,
  type Role,
  type Scheme,
} from "@/lib/theme.ts";
import { fixed, STOP_NAMES } from "@/lib/format.ts";

type Ramps = readonly ThemeRamp[];

export type Command =
  | {
      readonly kind: "create";
      readonly index: number;
      readonly theme: Theme;
      /** Where it came from: random seeds, or a copy of another theme. */
      readonly from: string;
      /** The theme that was current before, to return to when the creation is undone. */
      readonly previous: string | null;
    }
  | { readonly kind: "delete"; readonly index: number; readonly theme: Theme }
  | { readonly kind: "rename"; readonly from: string; readonly to: string }
  | {
      readonly kind: "step";
      readonly ramp: string;
      readonly index: number;
      readonly from: OkLCH;
      readonly to: OkLCH;
    }
  | {
      readonly kind: "role";
      readonly role: Role;
      readonly from: string | null;
      readonly to: string;
    }
  | {
      readonly kind: "override";
      readonly scheme: Scheme;
      readonly token: string;
      readonly from: Override | null;
      readonly to: Override | null;
    }
  | {
      readonly kind: "primary";
      readonly from: OkLCH;
      readonly to: OkLCH;
      readonly before: Ramps;
      readonly after: Ramps;
    }
  | {
      readonly kind: "secondary";
      readonly from: OkLCH | null;
      readonly to: OkLCH | null;
      readonly before: Ramps;
      readonly after: Ramps;
    }
  | {
      readonly kind: "harmony";
      readonly from: HarmonyKind;
      readonly to: HarmonyKind;
      readonly before: Ramps;
      readonly after: Ramps;
    }
  | { readonly kind: "gamut"; readonly from: Gamut; readonly to: Gamut };

export const KINDS: readonly Command["kind"][] = [
  "create",
  "delete",
  "rename",
  "step",
  "role",
  "override",
  "primary",
  "secondary",
  "harmony",
  "gamut",
];

export interface Entry {
  readonly id: string;
  /** When, as epoch milliseconds. */
  readonly at: number;
  /** The theme it happened to, as it was named then. */
  readonly theme: { readonly id: string; readonly name: string };
  readonly command: Command;
}

export interface Studio {
  readonly themes: readonly Theme[];
  readonly current: string | null;
  readonly log: readonly Entry[];
  /** Entries before the cursor are applied; from the cursor on, undone. */
  readonly cursor: number;
  /** Set by undo, redo, and selection: the next entry starts fresh instead of merging into the last. */
  readonly sealed: boolean;
}

/** How many entries the log keeps; the oldest fall off. */
export const MAX_ENTRIES = 500;
/** Two moves of the same thing within this window are one entry: a slider drag, a name typed. */
export const MERGE_WINDOW = 1000;

export const EMPTY: Studio = {
  themes: [],
  current: null,
  log: [],
  cursor: 0,
  sealed: true,
};

export function currentOf(s: Studio): Theme | null {
  return s.themes.find((b) => b.id === s.current) ?? s.themes[0] ?? null;
}

/* ---------- applying ---------- */

function onTheme(theme: Theme, c: Command, forward: boolean): Theme {
  switch (c.kind) {
    case "rename":
      return { ...theme, name: forward ? c.to : c.from };
    case "step":
      return withStep(theme, c.ramp, c.index, forward ? c.to : c.from);
    case "role": {
      const v = forward ? c.to : c.from;
      const assignment = { ...theme.assignment };
      if (v === null) delete assignment[c.role];
      else assignment[c.role] = v;
      return { ...theme, assignment };
    }
    case "override":
      return withOverride(theme, c.scheme, c.token, forward ? c.to : c.from);
    case "primary":
      return {
        ...theme,
        primary: forward ? c.to : c.from,
        ramps: forward ? c.after : c.before,
      };
    case "secondary":
      return {
        ...theme,
        secondary: forward ? c.to : c.from,
        ramps: forward ? c.after : c.before,
      };
    case "harmony":
      return {
        ...theme,
        harmony: forward ? c.to : c.from,
        ramps: forward ? c.after : c.before,
      };
    case "gamut":
      return withGamut(theme, forward ? c.to : c.from);
    case "create":
    case "delete":
      return theme;
  }
}

function insert(themes: readonly Theme[], index: number, b: Theme): Theme[] {
  const i = Math.max(0, Math.min(index, themes.length));
  return [...themes.slice(0, i), b, ...themes.slice(i)];
}

/** The theme to land on when the one at `index` is gone: the one that took its place, else the one above, else none. */
function neighbor(themes: readonly Theme[], index: number): string | null {
  return (themes[index] ?? themes[index - 1])?.id ?? null;
}

/** An entry applied forward, or its inverse. Selection follows the change, as undo does in Figma across pages. */
function apply(s: Studio, e: Entry, forward: boolean): Studio {
  const c = e.command;
  const adds = c.kind === "create" ? forward : c.kind === "delete" && !forward;
  const removes =
    c.kind === "delete" ? forward : c.kind === "create" && !forward;
  if (c.kind === "create" || c.kind === "delete") {
    if (adds) {
      return {
        ...s,
        themes: insert(s.themes, c.index, c.theme),
        current: c.theme.id,
      };
    }
    if (removes) {
      const rest = s.themes.filter((b) => b.id !== c.theme.id);
      const back =
        c.kind === "create" &&
        c.previous !== null &&
        rest.some((b) => b.id === c.previous)
          ? c.previous
          : neighbor(rest, c.index);
      return {
        ...s,
        themes: rest,
        current: s.current === c.theme.id ? back : s.current,
      };
    }
    return s;
  }
  if (!s.themes.some((b) => b.id === e.theme.id)) return s;
  const themes = s.themes.map((b) =>
    b.id === e.theme.id ? onTheme(b, c, forward) : b,
  );
  return { ...s, themes, current: e.theme.id };
}

/* ---------- merging ---------- */

const json = (v: unknown) => JSON.stringify(v);

function sameTarget(a: Command, b: Command): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "step":
      return b.kind === "step" && a.ramp === b.ramp && a.index === b.index;
    case "primary":
    case "secondary":
    case "rename":
      return true;
    default:
      return false;
  }
}

function merged(prev: Command, next: Command): Command {
  switch (prev.kind) {
    case "step":
      return next.kind === "step" ? { ...next, from: prev.from } : next;
    case "rename":
      return next.kind === "rename" ? { ...next, from: prev.from } : next;
    case "primary":
      return next.kind === "primary"
        ? { ...next, from: prev.from, before: prev.before }
        : next;
    case "secondary":
      return next.kind === "secondary"
        ? { ...next, from: prev.from, before: prev.before }
        : next;
    default:
      return next;
  }
}

/** A command that ends where it began is nothing, and is not kept. */
function isNoop(c: Command): boolean {
  switch (c.kind) {
    case "step":
    case "rename":
    case "primary":
    case "secondary":
    case "harmony":
    case "gamut":
    case "override":
    case "role":
      return json(c.from) === json(c.to);
    default:
      return false;
  }
}

/* ---------- the operations ---------- */

/** Do a command: apply it, log it, truncate anything undone, and merge it into the last entry when it continues the same move. */
export function perform(s: Studio, e: Entry): Studio {
  const applied = apply(s, e, true);
  const kept = s.log.slice(0, s.cursor);
  const prev = kept.at(-1);
  const continues =
    !s.sealed &&
    prev !== undefined &&
    prev.theme.id === e.theme.id &&
    sameTarget(prev.command, e.command) &&
    e.at - prev.at < MERGE_WINDOW;
  let log: Entry[];
  if (continues) {
    const m: Entry = {
      ...prev,
      at: e.at,
      command: merged(prev.command, e.command),
    };
    log = isNoop(m.command) ? kept.slice(0, -1) : [...kept.slice(0, -1), m];
  } else {
    log = [...kept, e];
  }
  if (log.length > MAX_ENTRIES) log = log.slice(log.length - MAX_ENTRIES);
  return { ...applied, log, cursor: log.length, sealed: false };
}

export function canUndo(s: Studio): boolean {
  return s.cursor > 0;
}
export function canRedo(s: Studio): boolean {
  return s.cursor < s.log.length;
}

export function undo(s: Studio): Studio {
  const e = s.log[s.cursor - 1];
  if (e === undefined) return s;
  return { ...apply(s, e, false), cursor: s.cursor - 1, sealed: true };
}

export function redo(s: Studio): Studio {
  const e = s.log[s.cursor];
  if (e === undefined) return s;
  return { ...apply(s, e, true), cursor: s.cursor + 1, sealed: true };
}

/** Undo this entry and everything after it. */
export function undoTo(s: Studio, id: string): Studio {
  const i = s.log.findIndex((e) => e.id === id);
  if (i < 0) return s;
  let next = s;
  while (next.cursor > i) next = undo(next);
  return next;
}

/** Redo up to and including this entry. */
export function redoTo(s: Studio, id: string): Studio {
  const i = s.log.findIndex((e) => e.id === id);
  if (i < 0) return s;
  let next = s;
  while (next.cursor <= i) next = redo(next);
  return next;
}

export function select(s: Studio, id: string): Studio {
  return s.themes.some((b) => b.id === id)
    ? { ...s, current: id, sealed: true }
    : s;
}

/** The next entry to undo, and the next to redo. */
export function peek(s: Studio): { undo: Entry | null; redo: Entry | null } {
  return { undo: s.log[s.cursor - 1] ?? null, redo: s.log[s.cursor] ?? null };
}

/* ---------- reading an entry ---------- */

/** One side of a change, as the activity feed shows it: a few words, with a color when there is one. */
export interface Side {
  readonly text: string;
  readonly color?: OkLCH;
}

export interface Description {
  /** What changed, in the theme: "primary 500 · L", "Harmony", "Created". */
  readonly change: string;
  readonly was: Side;
  readonly now: Side;
}

const hex = (c: OkLCH): Side => ({ text: formatHex(c).hex, color: c });
const none: Side = { text: "none" };
const overrideText = (o: Override | null): string =>
  o === null
    ? "preset"
    : "solve" in o
      ? `solve from ${o.from}`
      : (STOP_NAMES[o.step] ?? String(o.step));

export function describe(c: Command): Description {
  switch (c.kind) {
    case "create":
      return { change: "Created", was: { text: "" }, now: { text: c.from } };
    case "delete":
      return {
        change: "Deleted",
        was: { text: c.theme.name },
        now: { text: "" },
      };
    case "rename":
      return { change: "Renamed", was: { text: c.from }, now: { text: c.to } };
    case "step": {
      const channels = (["L", "C", "H"] as const).filter(
        (k) => c.from[k] !== c.to[k],
      );
      const where = `${c.ramp} ${STOP_NAMES[c.index] ?? c.index}`;
      if (channels.length === 1) {
        const k = channels[0]!;
        const digits = k === "H" ? 1 : 3;
        return {
          change: `${where} · ${k}`,
          was: { text: fixed(c.from[k], digits), color: c.from },
          now: { text: fixed(c.to[k], digits), color: c.to },
        };
      }
      return { change: where, was: hex(c.from), now: hex(c.to) };
    }
    case "role":
      return {
        change: `${c.role} role`,
        was: { text: c.from ?? "default" },
        now: { text: c.to },
      };
    case "override":
      return {
        change: `${c.scheme} ${c.token} step`,
        was: { text: overrideText(c.from) },
        now: { text: overrideText(c.to) },
      };
    case "primary":
      return { change: "Primary seed", was: hex(c.from), now: hex(c.to) };
    case "secondary":
      return {
        change: "Secondary seed",
        was: c.from === null ? none : hex(c.from),
        now: c.to === null ? none : hex(c.to),
      };
    case "harmony":
      return {
        change: "Harmony",
        was: { text: HARMONY_LABELS[c.from].name },
        now: { text: HARMONY_LABELS[c.to].name },
      };
    case "gamut":
      return { change: "Gamut", was: { text: c.from }, now: { text: c.to } };
  }
}

/** A one-line reading, for a tooltip on the undo button. */
export function summarize(e: Entry): string {
  const d = describe(e.command);
  const sides = [d.was.text, d.now.text].filter((t) => t !== "");
  return `${e.theme.name} · ${d.change}${sides.length > 0 ? ` · ${sides.join(" to ")}` : ""}`;
}
