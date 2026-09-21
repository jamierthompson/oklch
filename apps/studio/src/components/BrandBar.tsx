import { withGamut, type Brand } from "@jamiethompson/oklch-brand";
import { useRef } from "react";

import { SeedPicker } from "@/components/SeedPicker.tsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DRAFT } from "@/hooks/useBrands.ts";
import { download, fileName, serialize } from "@/lib/storage.ts";

export function BrandBar({
  brands,
  brand,
  draft,
  isDraft,
  onPick,
  onSelect,
  onUpdate,
  onSave,
  onOpen,
  onDuplicate,
  onRemove,
}: {
  brands: readonly Brand[];
  brand: Brand | null;
  draft: Brand | null;
  isDraft: boolean;
  onPick: (color: string) => string | null;
  onSelect: (id: string) => void;
  onUpdate: (b: Brand) => void;
  onSave: () => void;
  onOpen: (file: File | undefined) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const fileInput = (
    <input
      ref={file}
      type="file"
      accept="application/json,.json"
      className="hidden"
      onChange={(e) => onOpen(e.target.files?.[0])}
    />
  );

  if (brand === null) {
    return (
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h1 className="font-semibold">oklch studio</h1>
        <span className="text-sm text-muted-foreground">
          No brands on this machine yet.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => file.current?.click()}
        >
          Open file
        </Button>
        {fileInput}
      </header>
    );
  }

  const items: Record<string, string> = {
    ...(draft === null ? {} : { [DRAFT]: `Draft · ${draft.name}` }),
    ...Object.fromEntries(brands.map((b) => [b.id, b.name])),
  };
  const seed = brand.ramps.find((r) => r.seed.kind === "through")?.seed;
  const current = seed?.kind === "through" ? seed.color : undefined;

  return (
    <header className="grid gap-3 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-semibold">oklch studio</h1>
        <Label className="text-xs text-muted-foreground">Try a seed</Label>
        <SeedPicker compact onPick={onPick} current={current} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={isDraft ? DRAFT : brand.id}
          onValueChange={(v) => v !== null && onSelect(v)}
          items={items}
        >
          <SelectTrigger aria-label="Brand" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {draft !== null && (
              <SelectItem value={DRAFT}>Draft · {draft.name}</SelectItem>
            )}
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Brand name"
          className="w-40"
          value={brand.name}
          onChange={(e) => onUpdate({ ...brand, name: e.target.value })}
        />
        <Select
          value={brand.gamut}
          onValueChange={(v) =>
            v !== null && onUpdate(withGamut(brand, v as Brand["gamut"]))
          }
        >
          <SelectTrigger aria-label="Gamut" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="srgb">srgb</SelectItem>
            <SelectItem value="p3">p3</SelectItem>
          </SelectContent>
        </Select>
        {isDraft ? (
          <>
            <Badge variant="outline">Draft · not saved</Badge>
            <Button onClick={onSave} disabled={brand.name.trim() === ""}>
              Save brand
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onDuplicate}>
            Duplicate
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() =>
            download(fileName(brand), serialize(brand), "application/json")
          }
        >
          Save file
        </Button>
        <Button variant="outline" onClick={() => file.current?.click()}>
          Open file
        </Button>
        {fileInput}
        <Button variant="destructive" onClick={onRemove}>
          {isDraft ? "Discard draft" : "Delete"}
        </Button>
      </div>
    </header>
  );
}
