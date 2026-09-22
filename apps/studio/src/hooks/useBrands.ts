import { newId, type Brand } from "@/lib/brand.ts";
import { useCallback, useEffect, useMemo, useState } from "react";

import { load, save, type Stored } from "@/lib/storage.ts";

/** The switcher's entry for the unsaved draft. */
export const DRAFT = "draft";

/**
 * The brands on this machine, and at most one draft that is not.
 *
 * Trying a seed makes a draft: a whole palette, in memory only. It shows in
 * the switcher until it is saved as a brand or discarded, and nothing about
 * it reaches storage until then. Saved brands persist on every change.
 */
export function useBrands() {
  const [stored, setStored] = useState<Stored>(load);
  useEffect(() => save(stored), [stored]);
  const [draft, setDraft] = useState<Brand | null>(null);
  const [onDraft, setOnDraft] = useState(false);
  const [dirty, setDirty] = useState(false);

  const saved = useMemo<Brand | null>(
    () =>
      stored.brands.find((b) => b.id === stored.current) ??
      stored.brands[0] ??
      null,
    [stored],
  );
  const isDraft = onDraft && draft !== null;
  const brand = isDraft ? draft : saved;

  const update = useCallback(
    (next: Brand | ((b: Brand) => Brand)) => {
      if (isDraft) {
        setDraft((d) =>
          d === null ? d : typeof next === "function" ? next(d) : next,
        );
        setDirty(true);
        return;
      }
      setStored((s) => {
        const cur = s.brands.find((b) => b.id === s.current) ?? s.brands[0];
        if (cur === undefined) return s;
        const replaced = typeof next === "function" ? next(cur) : next;
        return {
          ...s,
          brands: s.brands.map((b) => (b.id === cur.id ? replaced : b)),
        };
      });
    },
    [isDraft],
  );

  const tryBrand = useCallback((b: Brand) => {
    setDraft(b);
    setOnDraft(true);
    setDirty(false);
  }, []);

  const saveDraft = useCallback(() => {
    if (draft === null) return;
    setStored((s) => ({ brands: [...s.brands, draft], current: draft.id }));
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

  /** A brand from a file: saved as it arrives. */
  const add = useCallback((b: Brand) => {
    setOnDraft(false);
    setStored((s) => ({ brands: [...s.brands, b], current: b.id }));
  }, []);

  const duplicate = useCallback(() => {
    if (brand === null) return;
    const copy = { ...brand, id: newId(), name: `${brand.name} copy` };
    setOnDraft(false);
    setStored((s) => ({ brands: [...s.brands, copy], current: copy.id }));
  }, [brand]);

  const remove = useCallback(() => {
    if (isDraft) {
      discardDraft();
      return;
    }
    setStored((s) => {
      const rest = s.brands.filter((b) => b.id !== s.current);
      return { brands: rest, current: rest[0]?.id ?? null };
    });
  }, [isDraft, discardDraft]);

  return {
    brands: stored.brands,
    brand,
    draft,
    isDraft,
    dirty,
    tryBrand,
    saveDraft,
    discardDraft,
    update,
    select,
    add,
    duplicate,
    remove,
  };
}
