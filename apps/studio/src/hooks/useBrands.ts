import { useCallback, useEffect, useMemo, useState } from "react";

import { newBrand, newId, type Brand } from "@jamiethompson/oklch-brand";
import { load, save, type Stored } from "@/lib/storage.ts";

/** A first brand, so the studio never opens empty. */
function seeded(): Stored {
  const stored = load();
  if (stored.brands.length > 0) return stored;
  const first = newBrand("Acme", "#2563eb", "srgb");
  return { brands: [first], current: first.id };
}

export function useBrands() {
  const [stored, setStored] = useState<Stored>(seeded);
  useEffect(() => save(stored), [stored]);

  const brand = useMemo(
    () =>
      stored.brands.find((b) => b.id === stored.current) ?? stored.brands[0]!,
    [stored],
  );

  const update = useCallback(
    (next: Brand | ((b: Brand) => Brand)) =>
      setStored((s) => {
        const cur = s.brands.find((b) => b.id === s.current) ?? s.brands[0]!;
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
      const cur = s.brands.find((b) => b.id === s.current) ?? s.brands[0]!;
      const copy = { ...cur, id: newId(), name: `${cur.name} copy` };
      return { brands: [...s.brands, copy], current: copy.id };
    });
  }, []);

  const remove = useCallback(() => {
    setStored((s) => {
      const rest = s.brands.filter((b) => b.id !== s.current);
      if (rest.length === 0) {
        const first = newBrand("Acme", "#2563eb", "srgb");
        return { brands: [first], current: first.id };
      }
      return { brands: rest, current: rest[0]!.id };
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
