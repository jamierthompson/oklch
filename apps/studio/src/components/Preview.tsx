import type { CSSProperties } from "react";
import type { TokenSetAudit } from "@jamiethompson/oklch";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cssVarsOf, type Brand, type Scheme } from "@/lib/brand.ts";

/** Static class names, so Tailwind emits them. */
const CHART = [
  ["bg-chart-1", 0.5],
  ["bg-chart-2", 0.8],
  ["bg-chart-3", 0.35],
  ["bg-chart-4", 1],
  ["bg-chart-5", 0.65],
] as const;

/**
 * Real shadcn components, skinned by the palette as it stands: the wrapper
 * sets every token inline, so what fails is visible, not hidden.
 */
export function Preview({
  brand,
  audit,
  scheme,
}: {
  brand: Brand;
  audit: TokenSetAudit;
  scheme: Scheme;
}) {
  const style = cssVarsOf(audit, scheme, brand.radius) as CSSProperties;
  return (
    <div
      className={scheme === "dark" ? "dark" : ""}
      data-testid={`preview-${scheme}`}
      style={style}
    >
      <div className="grid grid-cols-[9rem_1fr] rounded-lg border border-border bg-background text-foreground">
        <aside className="grid content-start gap-1 rounded-l-lg border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
          <div className="mb-2 text-xs font-semibold uppercase text-sidebar-foreground/70">
            {brand.name}
          </div>
          <div className="rounded-md bg-sidebar-primary px-2 py-1 text-sm text-sidebar-primary-foreground">
            Overview
          </div>
          <div className="rounded-md bg-sidebar-accent px-2 py-1 text-sm text-sidebar-accent-foreground">
            Reports
          </div>
          <div className="px-2 py-1 text-sm">Settings</div>
        </aside>
        <div className="grid gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{scheme} scheme</h2>
            <Tabs defaultValue="a">
              <TabsList>
                <TabsTrigger value="a">Day</TabsTrigger>
                <TabsTrigger value="b">Week</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>
                Muted description on the card surface.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm">
                Body text on the card.{" "}
                <a className="text-primary underline underline-offset-4">
                  A link in primary.
                </a>
              </p>
              <div className="grid gap-1">
                <Label htmlFor={`email-${scheme}`}>Email</Label>
                <Input id={`email-${scheme}`} placeholder="you@example.com" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id={`sw-${scheme}`} defaultChecked />
                <Label htmlFor={`sw-${scheme}`}>Notifications</Label>
                <Badge>badge</Badge>
                <Badge variant="secondary">secondary</Badge>
                <Badge variant="outline">outline</Badge>
              </div>
              <div
                className="flex h-16 items-end gap-1"
                aria-label="chart series"
              >
                {CHART.map(([cls, h]) => (
                  <div
                    key={cls}
                    className={`flex-1 rounded-t ${cls}`}
                    style={{ height: `${h * 100}%` }}
                  />
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Delete</Button>
            </CardFooter>
          </Card>
          <Alert>
            <AlertTitle>Muted surface</AlertTitle>
            <AlertDescription>
              Muted text sits on the muted surface here.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
