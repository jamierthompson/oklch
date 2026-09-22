import type { TokenSetAudit } from "@jamiethompson/oklch";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { type Theme } from "@/lib/theme.ts";
import { buildTheme } from "@/lib/build.ts";
import { download } from "@/lib/storage.ts";

export function ExportPanel({
  theme,
  audit,
}: {
  theme: Theme;
  audit: TokenSetAudit;
}) {
  const [tab, setTab] = useState("css");
  const outputs = useMemo(() => buildTheme(theme).outputs, [theme]);
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
