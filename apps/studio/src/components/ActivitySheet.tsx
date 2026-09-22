import { formatOklch, type OkLCH } from "@jamiethompson/oklch";
import { ListFilter, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { describe, summarize, type Entry, type Side } from "@/lib/history.ts";

/** When, relative to now, in as few characters as a narrow line allows. */
export function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} d ago` : new Date(at).toLocaleDateString();
}

function Dot({ color }: { color: OkLCH }) {
  return (
    <span
      aria-hidden
      className="inline-block size-3 shrink-0 rounded-sm border align-[-2px]"
      style={{ background: formatOklch(color) }}
    />
  );
}

function SideText({ side }: { side: Side }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 truncate">
      {side.color !== undefined && <Dot color={side.color} />}
      <span className="truncate">{side.text}</span>
    </span>
  );
}

/** One change: who and when, what, and from what to what. */
function Item({
  entry,
  applied,
  now,
  onUndoTo,
  onRedoTo,
}: {
  entry: Entry;
  applied: boolean;
  now: number;
  onUndoTo: (id: string) => void;
  onRedoTo: (id: string) => void;
}) {
  const d = describe(entry.command);
  const label = `${applied ? "Undo" : "Redo"} to here: ${summarize(entry)}`;
  const hasSides = d.was.text !== "" || d.now.text !== "";
  return (
    <li
      data-applied={applied}
      className={
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 border-b px-4 py-2.5 last:border-b-0" +
        (applied ? "" : " opacity-50")
      }
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm font-medium" title={entry.theme.name}>
          {entry.theme.name}
        </span>
        <time
          className="shrink-0 text-xs text-muted-foreground"
          dateTime={new Date(entry.at).toISOString()}
          title={new Date(entry.at).toLocaleString()}
        >
          {ago(entry.at, now)}
        </time>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="row-span-3 self-center"
        aria-label={label}
        title={label}
        onClick={() => (applied ? onUndoTo(entry.id) : onRedoTo(entry.id))}
      >
        {applied ? <Undo2 /> : <Redo2 />}
      </Button>
      <div className="truncate text-xs" title={d.change}>
        {d.change}
      </div>
      {hasSides && (
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
          {d.was.text !== "" && <SideText side={d.was} />}
          {d.was.text !== "" && d.now.text !== "" && (
            <span aria-hidden className="shrink-0">
              →
            </span>
          )}
          {d.now.text !== "" && <SideText side={d.now} />}
          <span className="sr-only">
            {d.was.text} to {d.now.text}
          </span>
        </div>
      )}
    </li>
  );
}

/**
 * The log, newest first, as a feed. Undone entries sit above the applied
 * ones, greyed: undoing an entry rewinds everything after it, and those
 * stay until redone or replaced. Photoshop's History panel, as a drawer,
 * so the palette stays in view while stepping back. Themes filter as
 * chips, the way a list of issues does.
 */
export function ActivitySheet({
  open,
  onOpenChange,
  log,
  cursor,
  names,
  onUndoTo,
  onRedoTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: readonly Entry[];
  cursor: number;
  /** The themes as they are named now; a theme that is gone keeps the name the log last saw. */
  names: ReadonlyMap<string, string>;
  onUndoTo: (id: string) => void;
  onRedoTo: (id: string) => void;
}) {
  const [only, setOnly] = useState<readonly string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open, log]);

  /** Every theme in the log, by its name now, or the last the log saw. */
  const themes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of log)
      seen.set(e.theme.id, names.get(e.theme.id) ?? e.theme.name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [log, names]);
  const active = only.filter((id) => themes.some((b) => b.id === id));
  const rows = log
    .map((e, i) => ({ e, applied: i < cursor }))
    .filter((r) => active.length === 0 || active.includes(r.e.theme.id))
    .reverse();
  const undone = rows.filter((r) => !r.applied);
  const done = rows.filter((r) => r.applied);
  const toggle = (id: string) =>
    setOnly((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md data-[side=right]:w-full"
        aria-describedby={undefined}
      >
        <SheetHeader className="gap-3 border-b">
          <SheetTitle>Activity</SheetTitle>
          <SheetDescription>
            Every change, newest first. Undo one and everything after it goes
            with it; those stay, greyed, until you redo or make a new change.
          </SheetDescription>
          <div
            className="flex flex-wrap items-center gap-1.5"
            aria-label="filters"
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
                disabled={themes.length === 0}
              >
                <ListFilter /> Filter
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-72 min-w-52 overflow-y-auto"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Theme</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {themes.map((b) => (
                    <DropdownMenuCheckboxItem
                      key={b.id}
                      checked={active.includes(b.id)}
                      onCheckedChange={() => toggle(b.id)}
                      closeOnClick={false}
                    >
                      {b.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {active.length === 0 ? (
              <span className="text-xs text-muted-foreground">All themes</span>
            ) : (
              active.map((id) => {
                const name = themes.find((b) => b.id === id)?.name ?? id;
                return (
                  <span
                    key={id}
                    className="inline-flex h-7 items-center gap-1 rounded-full border bg-muted/50 pr-1 pl-2.5 text-xs"
                  >
                    {name}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="rounded-full"
                      aria-label={`Remove filter ${name}`}
                      onClick={() => toggle(id)}
                    >
                      <X />
                    </Button>
                  </span>
                );
              })
            )}
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {log.length === 0
                ? "Nothing yet. Every change you make shows here, and can be undone from here."
                : "Nothing for this filter."}
            </p>
          ) : (
            <>
              {undone.length > 0 && (
                <section aria-label="undone">
                  <h3 className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    Undone · redo to bring back
                  </h3>
                  <ol>
                    {undone.map(({ e }) => (
                      <Item
                        key={e.id}
                        entry={e}
                        applied={false}
                        now={now}
                        onUndoTo={onUndoTo}
                        onRedoTo={onRedoTo}
                      />
                    ))}
                  </ol>
                </section>
              )}
              {done.length > 0 && (
                <section aria-label="applied">
                  {undone.length > 0 && (
                    <h3 className="border-t px-4 pt-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      Applied
                    </h3>
                  )}
                  <ol>
                    {done.map(({ e }) => (
                      <Item
                        key={e.id}
                        entry={e}
                        applied
                        now={now}
                        onUndoTo={onUndoTo}
                        onRedoTo={onRedoTo}
                      />
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
