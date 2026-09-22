/** The studio lives in localStorage: the themes, and the log of what happened to them. */

import { parse, type Theme } from "@/lib/theme.ts";
import { KINDS, type Entry, type Studio } from "@/lib/history.ts";

const KEY = "oklch-studio/themes";
/** What the log may take of localStorage's budget, in characters of JSON. The oldest entries go first. */
const LOG_BUDGET = 1_500_000;

export interface Stored extends Studio {
  /** Whether the presets have been added once; a deleted preset stays deleted. */
  readonly seeded: boolean;
}

function isEntry(v: unknown): v is Entry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  const theme = e["theme"] as Record<string, unknown> | undefined;
  const command = e["command"] as Record<string, unknown> | undefined;
  return (
    typeof e["id"] === "string" &&
    typeof e["at"] === "number" &&
    typeof theme === "object" &&
    theme !== null &&
    typeof theme["id"] === "string" &&
    typeof theme["name"] === "string" &&
    typeof command === "object" &&
    command !== null &&
    (KINDS as readonly unknown[]).includes(command["kind"])
  );
}

export function load(): Stored {
  const empty: Stored = {
    themes: [],
    current: null,
    log: [],
    cursor: 0,
    sealed: true,
    seeded: false,
  };
  try {
    const text = localStorage.getItem(KEY);
    if (text === null) return empty;
    const raw = JSON.parse(text) as Record<string, unknown>;
    const themes: Theme[] = [];
    for (const b of Array.isArray(raw["themes"]) ? raw["themes"] : []) {
      try {
        themes.push(parse(JSON.stringify(b)));
      } catch {
        // A theme this version cannot read is left where it is, not dropped.
      }
    }
    const current =
      typeof raw["current"] === "string" &&
      themes.some((b) => b.id === raw["current"])
        ? raw["current"]
        : (themes[0]?.id ?? null);
    // The log is advisory: one bad entry and the whole log is left behind, the themes are not.
    const rawLog = Array.isArray(raw["log"]) ? raw["log"] : [];
    const log = rawLog.every(isEntry) ? rawLog : [];
    const cursor =
      typeof raw["cursor"] === "number"
        ? Math.max(0, Math.min(log.length, raw["cursor"]))
        : log.length;
    return {
      themes,
      current,
      log,
      cursor,
      sealed: true,
      seeded: raw["seeded"] === true,
    };
  } catch {
    return empty;
  }
}

export function save(stored: Stored): void {
  let { log, cursor } = stored;
  let text = JSON.stringify({ ...stored, log, cursor });
  // Over budget: drop the oldest entries until it fits, keeping the cursor on the same entry.
  while (log.length > 0 && text.length > LOG_BUDGET) {
    const drop = Math.max(1, Math.ceil(log.length / 4));
    log = log.slice(drop);
    cursor = Math.max(0, cursor - drop);
    text = JSON.stringify({ ...stored, log, cursor });
  }
  try {
    localStorage.setItem(KEY, text);
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
