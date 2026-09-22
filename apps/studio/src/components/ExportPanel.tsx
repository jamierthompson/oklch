import type { TokenSetAudit } from "@jamiethompson/oklch";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { type Theme } from "@/lib/theme.ts";
import { buildTheme, slug } from "@/lib/build.ts";
import { download } from "@/lib/storage.ts";
import { presetOf } from "@/lib/presets.ts";

const SHIPS = ["css", "registry", "dtcg"] as const;
type Tab = (typeof SHIPS)[number] | "preset";

/**
 * What leaves the studio: the theme, in shadcn's shapes, once every pairing
 * clears; and the theme as a recipe at any time, so what the eye tuned can
 * go back into the presets file.
 */
export function ExportPanel({
  theme,
  audit,
}: {
  theme: Theme;
  audit: TokenSetAudit;
}) {
  const [tab, setTab] = useState<Tab>("css");
  const outputs = useMemo(() => buildTheme(theme).outputs, [theme]);
  const preset = useMemo(() => presetOf(theme), [theme]);
  const current =
    tab === "preset"
      ? {
          file: `${slug(theme.name)}.preset.ts`,
          text: preset,
          type: "text/plain",
        }
      : (outputs?.[tab] ?? null);
  const failing = [...audit.light, ...audit.dark].filter(
    (a) => a.outcome.kind !== "clears",
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as Tab)}
      className="grid gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="css">shadcn CSS</TabsTrigger>
          <TabsTrigger value="registry">registry item</TabsTrigger>
          <TabsTrigger value="dtcg">DTCG tokens</TabsTrigger>
          <TabsTrigger value="preset">preset</TabsTrigger>
        </TabsList>
        {current !== null && (
          <>
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
          </>
        )}
        {tab !== "preset" && audit.set !== null && (
          <span className="text-sm text-muted-foreground">
            {audit.set.receipts.length} receipts
          </span>
        )}
      </div>
      {SHIPS.map((k) => (
        <TabsContent key={k} value={k}>
          {outputs === null ? (
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
          ) : (
            <Textarea
              readOnly
              className="min-h-[32rem] font-mono text-xs"
              value={outputs[k].text}
              aria-label={`${k} export`}
            />
          )}
        </TabsContent>
      ))}
      <TabsContent value="preset" className="grid gap-2">
        <p className="text-xs text-muted-foreground">
          The theme as a recipe over the formula: its seeds, harmony, roles, and
          only the steps the eye moved. Paste it into the presets file to make
          it a preset.
        </p>
        <Textarea
          readOnly
          className="min-h-[32rem] font-mono text-xs"
          value={preset}
          aria-label="preset export"
        />
      </TabsContent>
    </Tabs>
  );
}
