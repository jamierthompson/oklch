import { newBrand, parse, type Brand } from "@jamiethompson/oklch-brand";
import { useRef, useState } from "react";

import { SeedPicker } from "@/components/SeedPicker.tsx";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The studio's first screen, and the one behind "New brand": nothing exists until you start it. */
export function Welcome({
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
    <div className="grid min-h-[70vh] place-items-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Start a brand</CardTitle>
          <CardDescription>
            One color in. The studio drafts a tinted neutral, the brand ramp
            through it, and a red, binds every shadcn token, and shows you what
            clears. Every step stays yours to move.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="brand-name">Name</Label>
            <Input
              id="brand-name"
              className="w-64"
              placeholder="Acme"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <SeedPicker value={seed} onChange={setSeed} />
          <div className="grid gap-1">
            <Label>Gamut</Label>
            <Select
              value={gamut}
              onValueChange={(v) => v !== null && setGamut(v as Brand["gamut"])}
            >
              <SelectTrigger aria-label="Gamut" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="srgb">srgb</SelectItem>
                <SelectItem value="p3">p3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error !== null && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
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
        </CardFooter>
      </Card>
    </div>
  );
}
