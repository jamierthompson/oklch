import type { Gamut } from "@jamiethompson/oklch";
import { History, Redo2, SlidersHorizontal, Undo2 } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Theme } from "@/lib/theme.ts";
import { summarize, type Entry } from "@/lib/history.ts";

/** Undo and redo, with what each would do in the title. `nudge` changes to bounce the undo button once. */
export function UndoRedo({
  peek,
  nudge = 0,
  onUndo,
  onRedo,
}: {
  peek: { undo: Entry | null; redo: Entry | null };
  nudge?: number;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const undoTitle =
    peek.undo === null ? "Nothing to undo" : `Undo ${summarize(peek.undo)}`;
  const redoTitle =
    peek.redo === null ? "Nothing to redo" : `Redo ${summarize(peek.redo)}`;
  return (
    <>
      <Button
        key={nudge}
        variant="ghost"
        size="icon"
        aria-label="Undo"
        title={undoTitle}
        disabled={peek.undo === null}
        onClick={onUndo}
        className={nudge > 0 ? "motion-safe:animate-nudge" : ""}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Redo"
        title={redoTitle}
        disabled={peek.redo === null}
        onClick={onRedo}
      >
        <Redo2 />
      </Button>
    </>
  );
}

export function StudioHeader({
  theme,
  nameRef,
  peek,
  nudge,
  onRename,
  onGamut,
  onUndo,
  onRedo,
  onActivity,
  onSeeds,
}: {
  theme: Theme;
  nameRef: RefObject<HTMLInputElement | null>;
  peek: { undo: Entry | null; redo: Entry | null };
  nudge: number;
  onRename: (name: string) => void;
  onGamut: (g: Gamut) => void;
  onUndo: () => void;
  onRedo: () => void;
  onActivity: () => void;
  onSeeds: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
      <SidebarTrigger />
      <Input
        ref={nameRef}
        aria-label="Theme name"
        className="w-44 font-medium sm:w-56"
        value={theme.name}
        onChange={(e) => onRename(e.target.value)}
      />
      <Select
        value={theme.gamut}
        onValueChange={(v) => v !== null && onGamut(v as Gamut)}
      >
        <SelectTrigger aria-label="Gamut" className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="srgb">srgb</SelectItem>
          <SelectItem value="p3">p3</SelectItem>
        </SelectContent>
      </Select>
      <div className="ml-auto flex items-center gap-1">
        <UndoRedo peek={peek} nudge={nudge} onUndo={onUndo} onRedo={onRedo} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Activity"
          title="Activity"
          onClick={onActivity}
        >
          <History />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={onSeeds}
        >
          <SlidersHorizontal /> Seeds
        </Button>
      </div>
    </header>
  );
}
