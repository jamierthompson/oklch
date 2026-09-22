import { auditOf, newBrand, type Brand } from "@/lib/brand.ts";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BrandBar } from "@/components/BrandBar.tsx";
import { ExportPanel } from "@/components/ExportPanel.tsx";
import { PalettePanel } from "@/components/PalettePanel.tsx";
import { SeedRail } from "@/components/SeedRail.tsx";
import { StartBrand } from "@/components/StartBrand.tsx";
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
import { useBrands } from "@/hooks/useBrands.ts";
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
  const studio = useBrands();
  const { brand, isDraft, dirty, tryBrand } = studio;
  const [pending, setPending] = useState<Brand | null>(null);
  const audit = useMemo(
    () => (brand === null ? null : auditOf(brand)),
    [brand],
  );

  /** Try a color: a draft, in memory. An edited draft asks before it is replaced. */
  const pick = useCallback(
    (color: string): string | null => {
      let next: Brand;
      try {
        next = newBrand(draftName(color), color, brand?.gamut ?? "srgb");
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
      if (isDraft && dirty) setPending(next);
      else tryBrand(next);
      return null;
    },
    [brand?.gamut, isDraft, dirty, tryBrand],
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
        <BrandBar
          brands={studio.brands}
          brand={brand}
          draft={studio.draft}
          isDraft={isDraft}
          onPick={pick}
          onSelect={studio.select}
          onUpdate={studio.update}
          onSave={studio.saveDraft}
          onDuplicate={studio.duplicate}
          onRemove={studio.remove}
        />
        {brand === null || audit === null ? (
          <main className="p-4">
            <StartBrand onPick={pick} />
          </main>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <SeedRail
              brand={brand}
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
                    brand={brand}
                    audit={audit}
                    onUpdate={studio.update}
                  />
                </TabsContent>
                <TabsContent value="export" className="mt-3">
                  <ExportPanel brand={brand} audit={audit} />
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
                another color replaces it. Save it as a brand first to keep it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pending !== null) tryBrand(pending);
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
