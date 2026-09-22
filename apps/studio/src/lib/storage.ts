/** Themes live in localStorage. */

import { parse, type Theme } from "@/lib/theme.ts";

const KEY = "oklch-studio/themes";

export interface Stored {
  readonly themes: readonly Theme[];
  readonly current: string | null;
}

export function load(): Stored {
  try {
    const text = localStorage.getItem(KEY);
    if (text === null) return { themes: [], current: null };
    const raw = JSON.parse(text) as { themes?: unknown[]; current?: unknown };
    const themes: Theme[] = [];
    for (const b of raw.themes ?? []) {
      try {
        themes.push(parse(JSON.stringify(b)));
      } catch {
        // A theme this version cannot read is left where it is, not dropped.
      }
    }
    const current =
      typeof raw.current === "string" &&
      themes.some((b) => b.id === raw.current)
        ? raw.current
        : (themes[0]?.id ?? null);
    return { themes, current };
  } catch {
    return { themes: [], current: null };
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
