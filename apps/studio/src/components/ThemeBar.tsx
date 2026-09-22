import { formatHex } from "@jamiethompson/oklch";

import { withGamut, type Theme } from "@/lib/theme.ts";

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
import { DRAFT } from "@/hooks/useThemes.ts";

export function ThemeBar({
  themes,
  theme,
  draft,
  isDraft,
  onPick,
  onSelect,
  onUpdate,
  onSave,
  onDuplicate,
  onRemove,
}: {
  themes: readonly Theme[];
  theme: Theme | null;
  draft: Theme | null;
  isDraft: boolean;
  onPick: (color: string) => string | null;
  onSelect: (id: string) => void;
  onUpdate: (b: Theme) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  if (theme === null) {
    return (
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h1 className="font-semibold">oklch studio</h1>
        <span className="text-sm text-muted-foreground">
          No themes on this machine yet.
        </span>
      </header>
    );
  }

  const items: Record<string, string> = {
    ...(draft === null ? {} : { [DRAFT]: `Draft · ${draft.name}` }),
    ...Object.fromEntries(themes.map((b) => [b.id, b.name])),
  };
  const current = formatHex(theme.primary).hex;

  return (
    <header className="grid gap-3 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-semibold">oklch studio</h1>
        <Label className="text-xs text-muted-foreground">Try a seed</Label>
        <SeedPicker compact onPick={onPick} current={current} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={isDraft ? DRAFT : theme.id}
          onValueChange={(v) => v !== null && onSelect(v)}
          items={items}
        >
          <SelectTrigger aria-label="Theme" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {draft !== null && (
              <SelectItem value={DRAFT}>Draft · {draft.name}</SelectItem>
            )}
            {themes.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Theme name"
          className="w-40"
          value={theme.name}
          onChange={(e) => onUpdate({ ...theme, name: e.target.value })}
        />
        <Select
          value={theme.gamut}
          onValueChange={(v) =>
            v !== null && onUpdate(withGamut(theme, v as Theme["gamut"]))
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
            <Button onClick={onSave} disabled={theme.name.trim() === ""}>
              Save theme
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onDuplicate}>
            Duplicate
          </Button>
        )}
        <Button variant="destructive" onClick={onRemove}>
          {isDraft ? "Discard draft" : "Delete"}
        </Button>
      </div>
    </header>
  );
}
