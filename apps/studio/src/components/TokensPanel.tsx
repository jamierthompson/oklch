import { SHADCN_TOKENS, type TokenSetAudit } from "@jamiethompson/oklch";

import { useState } from "react";

import { Swatch } from "@/components/Swatch.tsx";
import { Verdict } from "@/components/Verdict.tsx";
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
} from "@/lib/brand.ts";
import { STOP_NAMES } from "@/lib/format.ts";
import { landedOn, stepKey, type StepRef } from "@/lib/usage.ts";

/** The id of a token's cell in one scheme, for scrolling to it. */
export function tokenCellId(scheme: Scheme, token: string): string {
  return `token-${scheme}-${token}`;
}

function Cell({
  brand,
  audit,
  scheme,
  token,
  selection,
  onLocate,
  onUpdate,
}: {
  brand: Brand;
  audit: TokenSetAudit;
  scheme: Scheme;
  token: string;
  selection: StepRef | null;
  onLocate: (ref: StepRef) => void;
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
  const landed = landedOn(a);
  const onSelected =
    landed !== null &&
    selection !== null &&
    stepKey(landed) === stepKey(selection);
  const stepItems: Record<string, string> = {
    ...Object.fromEntries(STOP_NAMES.map((n, i) => [String(i), n])),
    ...(binding.on === undefined
      ? {}
      : { solve: `solve from ${fromOf(brand, scheme, token)}` }),
  };
  const setStep = (v: string) =>
    onUpdate(
      withOverride(
        brand,
        scheme,
        token,
        v === "solve"
          ? { solve: true, from: fromOf(brand, scheme, token) }
          : { step: Number(v) },
      ),
    );
  const stepLabel = solved
    ? `solved → ${landed === null ? "—" : STOP_NAMES[landed.step]}`
    : undefined;

  return (
    <TableCell
      id={tokenCellId(scheme, token)}
      data-selected={onSelected || undefined}
      className={
        "scroll-mt-4 align-top transition-colors" +
        (onSelected ? " bg-accent/60" : "")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md disabled:cursor-default"
          disabled={landed === null}
          aria-label={`show ${scheme} ${token} on its ramp`}
          title={
            landed === null
              ? "No color to show"
              : `${landed.ramp} ${STOP_NAMES[landed.step]} · show on the ramp`
          }
          onClick={() => landed !== null && onLocate(landed)}
        >
          <Swatch color={colorOf(a.outcome)} on={surface} />
        </button>
        <span
          className="w-16 truncate text-xs text-muted-foreground"
          title={`${token} is on the ${binding.ramp} ramp, by its role`}
        >
          {binding.ramp}
        </span>
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
                  `no step of ${binding.ramp} clears on ${binding.on}; move ${binding.on}, or give its role another ramp`,
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

/**
 * Every shadcn token in both schemes: the ramp its role put it on, the step
 * it sits at, its verdict on its surface, and the eye's way to move the
 * step. A token's swatch locates the step it landed on; cells on the
 * selected step are highlighted.
 */
export function TokensPanel({
  brand,
  audit,
  selection = null,
  onLocate = () => {},
  onUpdate,
}: {
  brand: Brand;
  audit: TokenSetAudit;
  /** The step selected on the ramps, if any. */
  selection?: StepRef | null;
  onLocate?: (ref: StepRef) => void;
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
            {(["light", "dark"] as const).map((scheme) => (
              <Cell
                key={scheme}
                brand={brand}
                audit={audit}
                scheme={scheme}
                token={token}
                selection={selection}
                onLocate={onLocate}
                onUpdate={onUpdate}
              />
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
