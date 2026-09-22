import { newId, type Theme } from "@/lib/theme.ts";
import { useCallback, useEffect, useMemo, useState } from "react";

import { load, save, type Stored } from "@/lib/storage.ts";

/** The switcher's entry for the unsaved draft. */
export const DRAFT = "draft";

/**
 * The themes on this machine, and at most one draft that is not.
 *
 * Trying a seed makes a draft: a whole palette, in memory only. It shows in
 * the switcher until it is saved as a theme or discarded, and nothing about
 * it reaches storage until then. Saved themes persist on every change.
 */
export function useThemes() {
  const [stored, setStored] = useState<Stored>(load);
  useEffect(() => save(stored), [stored]);
  const [draft, setDraft] = useState<Theme | null>(null);
  const [onDraft, setOnDraft] = useState(false);
  const [dirty, setDirty] = useState(false);

  const saved = useMemo<Theme | null>(
    () =>
      stored.themes.find((b) => b.id === stored.current) ??
      stored.themes[0] ??
      null,
    [stored],
  );
  const isDraft = onDraft && draft !== null;
  const theme = isDraft ? draft : saved;

  const update = useCallback(
    (next: Theme | ((b: Theme) => Theme)) => {
      if (isDraft) {
        setDraft((d) =>
          d === null ? d : typeof next === "function" ? next(d) : next,
        );
        setDirty(true);
        return;
      }
      setStored((s) => {
        const cur = s.themes.find((b) => b.id === s.current) ?? s.themes[0];
        if (cur === undefined) return s;
        const replaced = typeof next === "function" ? next(cur) : next;
        return {
          ...s,
          themes: s.themes.map((b) => (b.id === cur.id ? replaced : b)),
        };
      });
    },
    [isDraft],
  );

  const tryTheme = useCallback((b: Theme) => {
    setDraft(b);
    setOnDraft(true);
    setDirty(false);
  }, []);

  const saveDraft = useCallback(() => {
    if (draft === null) return;
    setStored((s) => ({ themes: [...s.themes, draft], current: draft.id }));
    setDraft(null);
    setOnDraft(false);
    setDirty(false);
  }, [draft]);

  const discardDraft = useCallback(() => {
    setDraft(null);
    setOnDraft(false);
    setDirty(false);
  }, []);

  const select = useCallback((id: string) => {
    if (id === DRAFT) {
      setOnDraft(true);
      return;
    }
    setOnDraft(false);
    setStored((s) => ({ ...s, current: id }));
  }, []);

  const duplicate = useCallback(() => {
    if (theme === null) return;
    const copy = { ...theme, id: newId(), name: `${theme.name} copy` };
    setOnDraft(false);
    setStored((s) => ({ themes: [...s.themes, copy], current: copy.id }));
  }, [theme]);

  const remove = useCallback(() => {
    if (isDraft) {
      discardDraft();
      return;
    }
    setStored((s) => {
      const rest = s.themes.filter((b) => b.id !== s.current);
      return { themes: rest, current: rest[0]?.id ?? null };
    });
  }, [isDraft, discardDraft]);

  return {
    themes: stored.themes,
    theme,
    draft,
    isDraft,
    dirty,
    tryTheme,
    saveDraft,
    discardDraft,
    update,
    select,
    duplicate,
    remove,
  };
}
