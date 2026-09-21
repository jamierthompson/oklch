import {
  auditOf,
  newBrand,
  parse,
  type Brand,
} from "@jamiethompson/oklch-brand";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BrandBar } from "@/components/BrandBar.tsx";
import { ExportPanel } from "@/components/ExportPanel.tsx";
import { PalettePanel } from "@/components/PalettePanel.tsx";
import { Preview } from "@/components/Preview.tsx";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
  const [fileError, setFileError] = useState<string | null>(null);
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

  const open = async (f: File | undefined) => {
    if (f === undefined) return;
    try {
      studio.add({ ...parse(await f.text()), id: crypto.randomUUID() });
      setFileError(null);
    } catch (e) {
      setFileError(
        `could not read ${f.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

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
          onOpen={(f) => void open(f)}
          onDuplicate={studio.duplicate}
          onRemove={studio.remove}
        />
        {fileError !== null && (
          <p className="px-4 pt-3 text-sm text-destructive">{fileError}</p>
        )}
        <main className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {brand === null || audit === null ? (
            <>
              <StartBrand onPick={pick} onOpen={(f) => void open(f)} />
              <Empty
                className="min-h-[60vh] border border-dashed"
                data-testid="preview-empty"
              >
                <EmptyHeader>
                  <EmptyTitle>Preview</EmptyTitle>
                  <EmptyDescription>
                    Real shadcn components, in both schemes, skinned by the
                    palette as it stands. They appear once a color is tried.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </>
          ) : (
            <>
              <Tabs defaultValue="palette" className="min-w-0">
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
              <div className="grid content-start gap-4 xl:sticky xl:top-4 xl:self-start">
                <Preview brand={brand} audit={audit} scheme="light" />
                <Preview brand={brand} audit={audit} scheme="dark" />
              </div>
            </>
          )}
        </main>
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
