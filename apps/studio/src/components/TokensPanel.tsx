import {
  SHADCN_TOKENS,
  type TokenAudit,
  type TokenSetAudit,
} from "@jamiethompson/oklch";

import { useState } from "react";

import { Swatch } from "@/components/Swatch.tsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  colorOf,
  fromOf,
  snapTo,
  withOverride,
  type Brand,
  type Scheme,
} from "@jamiethompson/oklch-brand";
import { fixed, STOP_NAMES } from "@/lib/format.ts";

function Verdict({ a }: { a: TokenAudit }) {
  const o = a.outcome;
  if (o.kind === "unresolved") {
    return (
      <Badge variant="destructive" title={o.reason}>
        unresolved
      </Badge>
    );
  }
  const r = o.kind === "clears" ? o.resolved.receipt : null;
  if (o.kind === "fails") {
    return (
      <Badge variant="destructive" title={`on ${o.on}`}>
        fails · WCAG {fixed(o.check.wcag.value, 2)} / {o.target.wcag} · APCA{" "}
        {fixed(o.check.apca.value, 0)} / {o.target.apca}
      </Badge>
    );
  }
  if (r === null) return <Badge variant="outline">no pairing</Badge>;
  return (
    <Badge variant="secondary" title={`on ${r.on}`}>
      WCAG {fixed(r.wcag.value, 2)} ≥ {r.target.wcag} · APCA{" "}
      {fixed(r.apca.value, 0)} ≥ {r.target.apca}
    </Badge>
  );
}

function Cell({
  brand,
  audit,
  scheme,
  token,
  onUpdate,
}: {
  brand: Brand;
  audit: TokenSetAudit;
  scheme: Scheme;
  token: string;
  onUpdate: (b: Brand) => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const a = audit[scheme].find((x) => x.token === token)!;
  const binding = a.binding;
  const surface =
    binding.on === undefined
      ? null
      : colorOf(audit[scheme].find((x) => x.token === binding.on)!.outcome);
  const override = brand.overrides[scheme][token];
  const solved = binding.step === undefined;
  const stepValue = solved ? "solve" : String(binding.step);
  const rampItems = Object.fromEntries(
    brand.ramps.map((r) => [r.name, r.name]),
  );
  const stepItems: Record<string, string> = {
    ...Object.fromEntries(STOP_NAMES.map((n, i) => [String(i), n])),
    ...(binding.on === undefined
      ? {}
      : { solve: `solve from ${fromOf(brand, scheme, token)}` }),
  };
  const setRamp = (ramp: string) =>
    onUpdate(
      withOverride(
        brand,
        scheme,
        token,
        solved
          ? { ramp, solve: true, from: fromOf(brand, scheme, token) }
          : { ramp, step: binding.step! },
      ),
    );
  const setStep = (v: string) =>
    onUpdate(
      withOverride(
        brand,
        scheme,
        token,
        v === "solve"
          ? {
              ramp: binding.ramp,
              solve: true,
              from: fromOf(brand, scheme, token),
            }
          : { ramp: binding.ramp, step: Number(v) },
      ),
    );
  const stepLabel = solved
    ? `solved → ${a.outcome.kind === "unresolved" ? "—" : STOP_NAMES[a.outcome.resolved.step]}`
    : undefined;

  return (
    <TableCell className="align-top">
      <div className="flex flex-wrap items-center gap-2">
        <Swatch color={colorOf(a.outcome)} on={surface} />
        <Select
          value={binding.ramp}
          onValueChange={(v) => v !== null && setRamp(v)}
          items={rampItems}
        >
          <SelectTrigger
            aria-label={`${scheme} ${token} ramp`}
            className="h-8 w-28"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {brand.ramps.map((r) => (
              <SelectItem key={r.name} value={r.name}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stepValue}
          onValueChange={(v) => v !== null && setStep(v)}
          items={stepItems}
        >
          <SelectTrigger
            aria-label={`${scheme} ${token} step`}
            className="h-8 w-36"
          >
            <SelectValue>{stepLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STOP_NAMES.map((n, i) => (
              <SelectItem key={n} value={String(i)}>
                {n}
              </SelectItem>
            ))}
            {binding.on !== undefined && (
              <SelectItem value="solve">
                solve from {fromOf(brand, scheme, token)}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <Verdict a={a} />
        {a.outcome.kind !== "clears" && binding.on !== undefined && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const snapped = snapTo(brand, scheme, token);
              if (snapped === null) {
                setNote(
                  `no step of ${binding.ramp} clears on ${binding.on}; pick another ramp, or move ${binding.on}`,
                );
              } else {
                setNote(null);
                onUpdate(withOverride(brand, scheme, token, snapped));
              }
            }}
          >
            Snap
          </Button>
        )}
        {note !== null && (
          <p className="w-full text-xs text-destructive">{note}</p>
        )}
        {override !== undefined && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onUpdate(withOverride(brand, scheme, token, null))}
          >
            Reset
          </Button>
        )}
      </div>
    </TableCell>
  );
}

export function TokensPanel({
  brand,
  audit,
  onUpdate,
}: {
  brand: Brand;
  audit: TokenSetAudit;
  onUpdate: (b: Brand) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>token</TableHead>
          <TableHead>light</TableHead>
          <TableHead>dark</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SHADCN_TOKENS.map((token) => (
          <TableRow key={token}>
            <TableCell className="align-top font-mono text-xs">
              {token}
            </TableCell>
            <Cell
              brand={brand}
              audit={audit}
              scheme="light"
              token={token}
              onUpdate={onUpdate}
            />
            <Cell
              brand={brand}
              audit={audit}
              scheme="dark"
              token={token}
              onUpdate={onUpdate}
            />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
