import { auditOf, newTheme, type Theme } from "@/lib/theme.ts";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ThemeBar } from "@/components/ThemeBar.tsx";
import { ExportPanel } from "@/components/ExportPanel.tsx";
import { PalettePanel } from "@/components/PalettePanel.tsx";
import { SeedRail } from "@/components/SeedRail.tsx";
import { StartTheme } from "@/components/StartTheme.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useThemes } from "@/hooks/useThemes.ts";
import { SEEDS } from "@/lib/seeds.ts";

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

/** A draft is named for its seed, or for what it is. */
function draftName(color: string): string {
  return (
    SEEDS.find((s) => s.color.toLowerCase() === color.toLowerCase())?.name ??
    "Draft"
  );
}

export function App() {
  useSystemScheme();
  const studio = useThemes();
  const { theme, isDraft, dirty, tryTheme } = studio;
  const [pending, setPending] = useState<Theme | null>(null);
  const audit = useMemo(
    () => (theme === null ? null : auditOf(theme)),
    [theme],
  );

  /** Try a color: a draft, in memory. An edited draft asks before it is replaced. */
  const pick = useCallback(
    (color: string): string | null => {
      let next: Theme;
      try {
        next = newTheme(draftName(color), color, theme?.gamut ?? "srgb");
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      if (isDraft && dirty) setPending(next);
      else tryTheme(next);
      return null;
    },
    [theme?.gamut, isDraft, dirty, tryTheme],
  );

  const failing =
    audit === null
      ? 0
      : [...audit.light, ...audit.dark].filter(
          (a) => a.outcome.kind !== "clears",
        ).length;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <ThemeBar
          themes={studio.themes}
          theme={theme}
          draft={studio.draft}
          isDraft={isDraft}
          onPick={pick}
          onSelect={studio.select}
          onUpdate={studio.update}
          onSave={studio.saveDraft}
          onDuplicate={studio.duplicate}
          onRemove={studio.remove}
        />
        {theme === null || audit === null ? (
          <main className="p-4">
            <StartTheme onPick={pick} />
          </main>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <SeedRail
              theme={theme}
              onUpdate={studio.update}
              className="rounded-lg border px-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
            />
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
                    onUpdate={studio.update}
                  />
                </TabsContent>
                <TabsContent value="export" className="mt-3">
                  <ExportPanel theme={theme} audit={audit} />
                </TabsContent>
              </Tabs>
            </main>
          </div>
        )}
        <AlertDialog
          open={pending !== null}
          onOpenChange={(o) => !o && setPending(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace the edited draft?</AlertDialogTitle>
              <AlertDialogDescription>
                The current draft has steps you moved and is not saved. Trying
                another color replaces it. Save it as a theme first to keep it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pending !== null) tryTheme(pending);
                  setPending(null);
                }}
              >
                Replace draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
