import { auditOf } from "@jamiethompson/oklch-brand";
import { useEffect, useMemo, useState } from "react";

import { BrandBar } from "@/components/BrandBar.tsx";
import { ExportPanel } from "@/components/ExportPanel.tsx";
import { Preview } from "@/components/Preview.tsx";
import { RampsPanel } from "@/components/RampsPanel.tsx";
import { TokensPanel } from "@/components/TokensPanel.tsx";
import { Welcome } from "@/components/Welcome.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBrands } from "@/hooks/useBrands.ts";

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

export function App() {
  useSystemScheme();
  const { brands, brand, update, select, add, duplicate, remove } = useBrands();
  const [creating, setCreating] = useState(false);
  const audit = useMemo(
    () => (brand === null ? null : auditOf(brand)),
    [brand],
  );

  if (brand === null || audit === null || creating) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Welcome
            onCreate={(b) => {
              add(b);
              setCreating(false);
            }}
            {...(brand === null ? {} : { onCancel: () => setCreating(false) })}
          />
        </div>
      </TooltipProvider>
    );
  }

  const failing = [...audit.light, ...audit.dark].filter(
    (a) => a.outcome.kind !== "clears",
  ).length;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <BrandBar
          brands={brands}
          brand={brand}
          onSelect={select}
          onUpdate={update}
          onAdd={add}
          onNew={() => setCreating(true)}
          onDuplicate={duplicate}
          onRemove={remove}
        />
        <main className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Tabs defaultValue="ramps" className="min-w-0">
            <TabsList>
              <TabsTrigger value="ramps">Ramps</TabsTrigger>
              <TabsTrigger value="tokens">
                Tokens{failing > 0 ? ` · ${failing} failing` : ""}
              </TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>
            <TabsContent value="ramps" className="mt-3">
              <RampsPanel brand={brand} onUpdate={update} />
            </TabsContent>
            <TabsContent value="tokens" className="mt-3">
              <TokensPanel brand={brand} audit={audit} onUpdate={update} />
            </TabsContent>
            <TabsContent value="export" className="mt-3">
              <ExportPanel brand={brand} audit={audit} />
            </TabsContent>
          </Tabs>
          <div className="grid content-start gap-4 xl:sticky xl:top-4 xl:self-start">
            <Preview brand={brand} audit={audit} scheme="light" />
            <Preview brand={brand} audit={audit} scheme="dark" />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
