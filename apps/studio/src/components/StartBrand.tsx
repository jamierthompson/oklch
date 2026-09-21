import { newBrand, parse, type Brand } from "@jamiethompson/oklch-brand";
import { useRef, useState } from "react";

import { SeedPicker } from "@/components/SeedPicker.tsx";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The studio's empty state, and what "New brand" opens: nothing exists until you start it. */
export function StartBrand({
  onCreate,
  onCancel,
}: {
  onCreate: (b: Brand) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [gamut, setGamut] = useState<Brand["gamut"]>("srgb");
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const create = () => {
    try {
      onCreate(newBrand(name.trim() || "Untitled", seed.trim(), gamut));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const open = async (f: File | undefined) => {
    if (f === undefined) return;
    try {
      onCreate({ ...parse(await f.text()), id: crypto.randomUUID() });
    } catch (e) {
      setError(
        `could not read ${f.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <Empty className="min-h-[60vh] border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <span
            aria-hidden
            className="block size-6 rounded-full bg-[conic-gradient(in_oklch_longer_hue,oklch(0.7_0.15_0),oklch(0.7_0.15_360))]"
          />
        </EmptyMedia>
        <EmptyTitle>No brand yet</EmptyTitle>
        <EmptyDescription>
          Pick a color to start from, or type your own. The studio drafts a
          tinted neutral, the brand ramp through it, and a red, binds every
          shadcn token, and shows you what clears. Every step stays yours to
          move.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-lg gap-4">
        <SeedPicker value={seed} onChange={setSeed} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label htmlFor="brand-name">Name</Label>
            <Input
              id="brand-name"
              className="w-48"
              placeholder="Acme"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <div className="grid gap-1">
            <Label>Gamut</Label>
            <Select
              value={gamut}
              onValueChange={(v) => v !== null && setGamut(v as Brand["gamut"])}
            >
              <SelectTrigger aria-label="Gamut" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="srgb">srgb</SelectItem>
                <SelectItem value="p3">p3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={create} disabled={seed.trim() === ""}>
            Create
          </Button>
          <Button variant="outline" onClick={() => file.current?.click()}>
            Open a brand file
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void open(e.target.files?.[0])}
          />
          {onCancel !== undefined && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </EmptyContent>
    </Empty>
  );
}
