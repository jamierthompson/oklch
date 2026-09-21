import { useRef, useState } from "react";

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
import { newBrand, parse, withGamut, type Brand } from "@/lib/brand.ts";
import { download, fileName, serialize } from "@/lib/storage.ts";

export function BrandBar({
  brands,
  brand,
  onSelect,
  onUpdate,
  onAdd,
  onDuplicate,
  onRemove,
}: {
  brands: readonly Brand[];
  brand: Brand;
  onSelect: (id: string) => void;
  onUpdate: (b: Brand) => void;
  onAdd: (b: Brand) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [seed, setSeed] = useState("#2563eb");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const create = () => {
    try {
      onAdd(newBrand(name.trim() || "Untitled", seed.trim(), brand.gamut));
      setName("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const importFile = async (f: File | undefined) => {
    if (f === undefined) return;
    try {
      onAdd({ ...parse(await f.text()), id: crypto.randomUUID() });
      setError(null);
    } catch (e) {
      setError(
        `could not read ${f.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const items = Object.fromEntries(brands.map((b) => [b.id, b.name]));

  return (
    <header className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
      <div className="grid gap-1">
        <Label htmlFor="brand">Brand</Label>
        <div className="flex gap-2">
          <Select
            value={brand.id}
            onValueChange={(v) => v !== null && onSelect(v)}
            items={items}
          >
            <SelectTrigger id="brand" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
          <Button variant="outline" onClick={onDuplicate}>
            Duplicate
          </Button>
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
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
          <Button variant="destructive" onClick={onRemove}>
            Delete
          </Button>
        </div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="new-brand">New brand from a color</Label>
        <div className="flex gap-2">
          <Input
            id="new-brand"
            className="w-36"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            aria-label="Seed color"
            className="w-40 font-mono"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button onClick={create}>Create</Button>
        </div>
      </div>
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
    </header>
  );
}
