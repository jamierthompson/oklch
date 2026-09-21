import {
  tokenSetToDesignTokens,
  tokenSetToRegistryItem,
  tokenSetToShadcnCss,
  type TokenSetAudit,
} from "@jamiethompson/oklch";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Brand } from "@/lib/brand.ts";
import { download } from "@/lib/storage.ts";

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "brand"
  );
}

export function ExportPanel({
  brand,
  audit,
}: {
  brand: Brand;
  audit: TokenSetAudit;
}) {
  const [tab, setTab] = useState("css");
  const outputs = useMemo(() => {
    const set = audit.set;
    if (set === null) return null;
    const name = slug(brand.name);
    return {
      css: {
        text: tokenSetToShadcnCss(set, { radius: brand.radius }),
        file: `${name}.css`,
        type: "text/css",
      },
      registry: {
        text: JSON.stringify(
          tokenSetToRegistryItem(set, { name, title: brand.name }),
          null,
          2,
        ),
        file: `${name}.registry.json`,
        type: "application/json",
      },
      dtcg: {
        text: JSON.stringify(tokenSetToDesignTokens(set), null, 2),
        file: `${name}.tokens.json`,
        type: "application/json",
      },
    } as const;
  }, [audit.set, brand.name, brand.radius]);

  if (outputs === null) {
    const failing = [...audit.light, ...audit.dark].filter(
      (a) => a.outcome.kind !== "clears",
    );
    return (
      <Alert variant="destructive">
        <AlertTitle>Nothing ships yet</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-4">
            {audit.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
            {failing.map((a) => (
              <li key={`${a.scheme}/${a.token}`}>
                {a.scheme}/{a.token}:{" "}
                {a.outcome.kind === "unresolved"
                  ? a.outcome.reason
                  : a.outcome.kind === "fails"
                    ? `does not clear on ${a.outcome.on}`
                    : "clears"}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }
  const current = outputs[tab as keyof typeof outputs] ?? outputs.css;
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(String(v))}
      className="grid gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="css">shadcn CSS</TabsTrigger>
          <TabsTrigger value="registry">registry item</TabsTrigger>
          <TabsTrigger value="dtcg">DTCG tokens</TabsTrigger>
        </TabsList>
        <Button
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(current.text)}
        >
          Copy
        </Button>
        <Button
          variant="outline"
          onClick={() => download(current.file, current.text, current.type)}
        >
          Download {current.file}
        </Button>
        <span className="text-sm text-muted-foreground">
          {audit.set!.receipts.length} receipts
        </span>
      </div>
      {(["css", "registry", "dtcg"] as const).map((k) => (
        <TabsContent key={k} value={k}>
          <Textarea
            readOnly
            className="min-h-[32rem] font-mono text-xs"
            value={outputs[k].text}
            aria-label={`${k} export`}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
