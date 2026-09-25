import type { Gamut, OkLCH } from "@jamiethompson/oklch";
import { useCallback, useEffect, useRef, useState } from "react";

import { autoName, copyName } from "@/lib/names.ts";
import {
  randomTheme,
  newId,
  withHarmony,
  withOverride,
  withPrimary,
  withRole,
  withSecondary,
  type Theme,
  type HarmonyKind,
  type Override,
  type Role,
  type Scheme,
} from "@/lib/theme.ts";
import * as H from "@/lib/history.ts";
import { load, save, type Stored } from "@/lib/storage.ts";
import { themeFromPreset, PRESETS } from "@/lib/presets.ts";

/** What is stored, with the presets added the first time. Existing themes stay above them. */
function initial(): Stored {
  const stored = load();
  if (stored.seeded) return stored;
  const themes = [...stored.themes, ...PRESETS.map(themeFromPreset)];
  return {
    ...stored,
    themes,
    current: stored.current ?? themes[0]?.id ?? null,
    seeded: true,
  };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The themes on this machine and everything that happens to them. Every
 * change is a command in the log, applied at once and persisted at once;
 * undo is the safety net, so there is no draft and nothing to save.
 */
export function useStudio() {
  const [state, setState] = useState<Stored>(initial);
  useEffect(() => save(state), [state]);
  const latest = useRef(state);
  latest.current = state;

  const entry = (b: Theme, command: H.Command): H.Entry => ({
    id: newId(),
    at: Date.now(),
    theme: { id: b.id, name: b.name },
    command,
  });

  /**
   * A command on one theme, built from the theme as it stands. `build` may
   * throw; the message comes back and nothing changes. It runs once now, to
   * answer, and once more against the state React hands over, to apply.
   */
  const on = useCallback(
    (
      id: string | null,
      build: (b: Theme, s: Stored) => H.Command | null,
    ): string | null => {
      const find = (s: Stored) =>
        id === null
          ? H.currentOf(s)
          : (s.themes.find((b) => b.id === id) ?? null);
      const now = find(latest.current);
      if (now === null) return "no theme";
      try {
        build(now, latest.current);
      } catch (e) {
        return message(e);
      }
      setState((s) => {
        const b = find(s);
        if (b === null) return s;
        try {
          const c = build(b, s);
          return c === null ? s : { ...s, ...H.perform(s, entry(b, c)) };
        } catch {
          return s;
        }
      });
      return null;
    },
    [],
  );

  /** A new theme goes at the top; a copy, `index`, directly below what it copies. */
  const create = useCallback(
    (
      make: (s: Stored) => Theme,
      from: string,
      index: (s: Stored) => number = () => 0,
    ): string | null => {
      try {
        make(latest.current);
      } catch (e) {
        return message(e);
      }
      setState((s) => {
        try {
          const theme = make(s);
          const command: H.Command = {
            kind: "create",
            index: index(s),
            theme,
            from,
            previous: s.current,
          };
          return { ...s, ...H.perform(s, entry(theme, command)) };
        } catch {
          return s;
        }
      });
      return null;
    },
    [],
  );

  /** A theme with a random name, seeds, and harmony, at the top. */
  const createRandom = useCallback((): string | null => {
    const theme = randomTheme(
      autoName(latest.current.themes.map((x) => x.name)),
    );
    return create(() => theme, "random seeds");
  }, [create]);

  /** A copy, directly below the theme it copies. */
  const duplicate = useCallback(
    (id: string): string | null => {
      const b = latest.current.themes.find((x) => x.id === id);
      if (b === undefined) return "no theme";
      return create(
        ({ themes }) => ({
          ...b,
          id: newId(),
          name: copyName(
            b.name,
            themes.map((x) => x.name),
          ),
        }),
        `a copy of ${b.name}`,
        ({ themes }) => themes.findIndex((x) => x.id === id) + 1,
      );
    },
    [create],
  );

  const remove = useCallback(
    (id: string) =>
      on(id, (b, s) => ({
        kind: "delete",
        index: s.themes.findIndex((x) => x.id === b.id),
        theme: b,
      })),
    [on],
  );

  const rename = useCallback(
    (id: string, name: string) =>
      on(id, (b) => ({ kind: "rename", from: b.name, to: name })),
    [on],
  );

  const select = useCallback(
    (id: string) => setState((s) => ({ ...s, ...H.select(s, id) })),
    [],
  );

  const moveStep = useCallback(
    (ramp: string, index: number, to: OkLCH) =>
      on(null, (b) => {
        const from = b.ramps.find((r) => r.name === ramp)?.steps[index];
        if (from === undefined) throw new Error(`no step ${index} on ${ramp}`);
        return { kind: "step", ramp, index, from, to };
      }),
    [on],
  );

  const setRole = useCallback(
    (role: Role, ramp: string) =>
      on(null, (b) => {
        withRole(b, role, ramp);
        return {
          kind: "role",
          role,
          from: b.assignment[role] ?? null,
          to: ramp,
        };
      }),
    [on],
  );

  const setOverride = useCallback(
    (scheme: Scheme, token: string, to: Override | null) =>
      on(null, (b) => {
        withOverride(b, scheme, token, to);
        return {
          kind: "override",
          scheme,
          token,
          from: b.overrides[scheme][token] ?? null,
          to,
        };
      }),
    [on],
  );

  const setPrimary = useCallback(
    (to: OkLCH) =>
      on(null, (b) => ({
        kind: "primary",
        from: b.primary,
        to,
        before: b.ramps,
        after: withPrimary(b, to).ramps,
      })),
    [on],
  );

  const setSecondary = useCallback(
    (to: OkLCH | null) =>
      on(null, (b) => ({
        kind: "secondary",
        from: b.secondary,
        to,
        before: b.ramps,
        after: withSecondary(b, to).ramps,
      })),
    [on],
  );

  const setHarmony = useCallback(
    (to: HarmonyKind) =>
      on(null, (b) => ({
        kind: "harmony",
        from: b.harmony,
        to,
        before: b.ramps,
        after: withHarmony(b, to).ramps,
      })),
    [on],
  );

  const setGamut = useCallback(
    (to: Gamut) => on(null, (b) => ({ kind: "gamut", from: b.gamut, to })),
    [on],
  );

  const undo = useCallback(() => setState((s) => ({ ...s, ...H.undo(s) })), []);
  const redo = useCallback(() => setState((s) => ({ ...s, ...H.redo(s) })), []);
  const undoTo = useCallback(
    (id: string) => setState((s) => ({ ...s, ...H.undoTo(s, id) })),
    [],
  );
  const redoTo = useCallback(
    (id: string) => setState((s) => ({ ...s, ...H.redoTo(s, id) })),
    [],
  );

  return {
    themes: state.themes,
    theme: H.currentOf(state),
    log: state.log,
    cursor: state.cursor,
    peek: H.peek(state),
    canUndo: H.canUndo(state),
    canRedo: H.canRedo(state),
    createRandom,
    duplicate,
    remove,
    rename,
    select,
    moveStep,
    setRole,
    setOverride,
    setPrimary,
    setSecondary,
    setHarmony,
    setGamut,
    undo,
    redo,
    undoTo,
    redoTo,
  };
}

export type Studio = ReturnType<typeof useStudio>;
