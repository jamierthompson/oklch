/** Brands live in localStorage; a JSON file is the way out and in. */

import { parse, serialize, type Brand } from "@jamiethompson/oklch-brand";

const KEY = "oklch-studio/brands";

export interface Stored {
  readonly brands: readonly Brand[];
  readonly current: string | null;
}

export function load(): Stored {
  try {
    const text = localStorage.getItem(KEY);
    if (text === null) return { brands: [], current: null };
    const raw = JSON.parse(text) as { brands?: unknown[]; current?: unknown };
    const brands: Brand[] = [];
    for (const b of raw.brands ?? []) {
      try {
        brands.push(parse(JSON.stringify(b)));
      } catch {
        // A brand this version cannot read is left where it is, not dropped.
      }
    }
    const current =
      typeof raw.current === "string" &&
      brands.some((b) => b.id === raw.current)
        ? raw.current
        : (brands[0]?.id ?? null);
    return { brands, current };
  } catch {
    return { brands: [], current: null };
  }
}

export function save(stored: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the session still works, it just will not persist.
  }
}

export function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function fileName(brand: Brand): string {
  return `${
    brand.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "brand"
  }.oklch.json`;
}

export { serialize };
