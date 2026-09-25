import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActivitySheet } from "@/components/ActivitySheet.tsx";
import { ThemeSidebar } from "@/components/ThemeSidebar.tsx";
import { ExportPanel } from "@/components/ExportPanel.tsx";
import { PalettePanel } from "@/components/PalettePanel.tsx";
import { SeedRail } from "@/components/SeedRail.tsx";
import { StudioHeader, UndoRedo } from "@/components/StudioHeader.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStudio } from "@/hooks/useStudio.ts";
import { auditOf } from "@/lib/theme.ts";

function useSystemScheme() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/** ⌘Z and ⇧⌘Z, except inside a field, where the field's own undo wins. */
function useUndoKeys(undo: () => void, redo: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !(e.metaKey || e.ctrlKey) ||
        e.key.toLowerCase() !== "z" ||
        editable(e.target)
      )
        return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
}

const KNOWS_UNDO = "oklch-studio/knows-undo";
const readKnowsUndo = () => {
  try {
    return localStorage.getItem(KNOWS_UNDO) === "true";
  } catch {
    return false;
  }
};

/**
 * The undo button bounces on each new change, until undo or redo has been
 * used once, by any means: after that the user knows it is there.
 */
function useUndoNudge(logLength: number, undo: () => void, redo: () => void) {
  const [knows, setKnows] = useState(readKnowsUndo);
  const [nudge, setNudge] = useState(0);
  const prev = useRef(logLength);
  useEffect(() => {
    if (logLength > prev.current && !knows) setNudge((n) => n + 1);
    prev.current = logLength;
  }, [logLength, knows]);
  const learn = useCallback(() => {
    setKnows(true);
    try {
      localStorage.setItem(KNOWS_UNDO, "true");
    } catch {
      // Not persisted; the nudge comes back next visit, which is harmless.
    }
  }, []);
  const learnedUndo = useCallback(() => {
    learn();
    undo();
  }, [learn, undo]);
  const learnedRedo = useCallback(() => {
    learn();
    redo();
  }, [learn, redo]);
  return { nudge: knows ? 0 : nudge, undo: learnedUndo, redo: learnedRedo };
}

export function App() {
  useSystemScheme();
  const studio = useStudio();
  const { theme } = studio;
  const { nudge, undo, redo } = useUndoNudge(
    studio.log.length,
    studio.undo,
    studio.redo,
  );
  useUndoKeys(undo, redo);
  const [activity, setActivity] = useState(false);
  const [seeds, setSeeds] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const audit = useMemo(
    () => (theme === null ? null : auditOf(theme)),
    [theme],
  );
  const names = useMemo(
    () => new Map(studio.themes.map((b) => [b.id, b.name])),
    [studio.themes],
  );

  const failing =
    audit === null
      ? 0
      : [...audit.light, ...audit.dark].filter(
          (a) => a.outcome.kind !== "clears",
        ).length;

  const themeActions = {
    onSelect: studio.select,
    onNew: studio.createRandom,
    onRename: (id: string) => {
      studio.select(id);
      requestAnimationFrame(() => {
        nameRef.current?.focus();
        nameRef.current?.select();
      });
    },
    onDuplicate: studio.duplicate,
    onDelete: studio.remove,
  };
  const paletteActions = {
    onStep: studio.moveStep,
    onRole: studio.setRole,
    onOverride: studio.setOverride,
  };
  const rail = (className: string) =>
    theme === null ? null : (
      <SeedRail
        theme={theme}
        onPrimary={studio.setPrimary}
        onSecondary={studio.setSecondary}
        onHarmony={studio.setHarmony}
        className={className}
      />
    );

  return (
    <TooltipProvider>
      <SidebarProvider>
        <ThemeSidebar
          themes={studio.themes}
          current={theme?.id ?? null}
          actions={themeActions}
        />
        <SidebarInset className="min-w-0">
          {theme === null || audit === null ? (
            <main className="p-4">
              <Empty className="min-h-[60vh] border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>No themes</EmptyTitle>
                  <EmptyDescription>Add one with +.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </main>
          ) : (
            <>
              <StudioHeader
                theme={theme}
                nameRef={nameRef}
                peek={studio.peek}
                nudge={nudge}
                onRename={(name) => studio.rename(theme.id, name)}
                onGamut={studio.setGamut}
                onUndo={undo}
                onRedo={redo}
                onActivity={() => setActivity(true)}
                onSeeds={() => setSeeds(true)}
              />
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <main className="min-w-0">
                  <Tabs defaultValue="palette">
                    <TabsList>
                      <TabsTrigger value="palette">
                        Palette{failing > 0 ? ` · ${failing} failing` : ""}
                      </TabsTrigger>
                      <TabsTrigger value="export">Export</TabsTrigger>
                    </TabsList>
                    {/* Kept mounted so the selected step survives a look at Export. */}
                    <TabsContent value="palette" className="mt-3" keepMounted>
                      <PalettePanel
                        theme={theme}
                        audit={audit}
                        actions={paletteActions}
                      />
                    </TabsContent>
                    <TabsContent value="export" className="mt-3">
                      <ExportPanel theme={theme} audit={audit} />
                    </TabsContent>
                  </Tabs>
                </main>
                {rail(
                  "hidden rounded-lg border px-4 lg:sticky lg:top-4 lg:grid lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto",
                )}
              </div>
              <footer className="max-w-prose px-4 pb-6 text-xs leading-relaxed text-muted-foreground">
                Not affiliated with or endorsed by the NFL or any team. Team
                names are trademarks of their owners and identify whose colors a
                palette is derived from; the hexes are community-sourced
                approximations, not official values.
              </footer>
            </>
          )}
        </SidebarInset>
        <ActivitySheet
          open={activity}
          onOpenChange={setActivity}
          log={studio.log}
          cursor={studio.cursor}
          names={names}
          onUndoTo={studio.undoTo}
          onRedoTo={studio.redoTo}
        />
        <Sheet open={seeds} onOpenChange={setSeeds}>
          <SheetContent
            side="right"
            className="w-full overflow-y-auto sm:max-w-sm data-[side=right]:w-full"
          >
            <SheetHeader className="pr-12">
              <div className="flex items-center gap-2">
                <SheetTitle>Seeds</SheetTitle>
                <div className="ml-auto flex items-center gap-1">
                  <UndoRedo peek={studio.peek} onUndo={undo} onRedo={redo} />
                </div>
              </div>
              <SheetDescription>
                The two seeds and the harmony the ramps are drafted from.
              </SheetDescription>
            </SheetHeader>
            {rail("px-4")}
          </SheetContent>
        </Sheet>
      </SidebarProvider>
    </TooltipProvider>
  );
}
