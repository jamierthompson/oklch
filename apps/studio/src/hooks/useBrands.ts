import { newId, type Brand } from "@jamiethompson/oklch-brand";
import { useCallback, useEffect, useMemo, useState } from "react";

import { load, save, type Stored } from "@/lib/storage.ts";

/** The brands on this machine. Nothing is seeded: the studio opens empty until you start one. */
export function useBrands() {
  const [stored, setStored] = useState<Stored>(load);
  useEffect(() => save(stored), [stored]);

  const brand = useMemo<Brand | null>(
    () =>
      stored.brands.find((b) => b.id === stored.current) ??
      stored.brands[0] ??
      null,
    [stored],
  );

  const update = useCallback(
    (next: Brand | ((b: Brand) => Brand)) =>
      setStored((s) => {
        const cur = s.brands.find((b) => b.id === s.current) ?? s.brands[0];
        if (cur === undefined) return s;
        const replaced = typeof next === "function" ? next(cur) : next;
        return {
          ...s,
          brands: s.brands.map((b) => (b.id === cur.id ? replaced : b)),
        };
      }),
    [],
  );

  const select = useCallback(
    (id: string) => setStored((s) => ({ ...s, current: id })),
    [],
  );

  const add = useCallback((b: Brand) => {
    setStored((s) => ({ brands: [...s.brands, b], current: b.id }));
  }, []);

  const duplicate = useCallback(() => {
    setStored((s) => {
      const cur = s.brands.find((b) => b.id === s.current) ?? s.brands[0];
      if (cur === undefined) return s;
      const copy = { ...cur, id: newId(), name: `${cur.name} copy` };
      return { brands: [...s.brands, copy], current: copy.id };
    });
  }, []);

  const remove = useCallback(() => {
    setStored((s) => {
      const rest = s.brands.filter((b) => b.id !== s.current);
      return { brands: rest, current: rest[0]?.id ?? null };
    });
  }, []);

  return {
    brands: stored.brands,
    brand,
    update,
    select,
    add,
    duplicate,
    remove,
  };
}
