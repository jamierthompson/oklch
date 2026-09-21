import { useRef } from "react";

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

/** The studio's empty state: nothing exists until a color is tried. */
export function StartBrand({
  onPick,
  onOpen,
}: {
  onPick: (color: string) => string | null;
  onOpen: (file: File | undefined) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
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
          Try a color. The studio drafts a tinted neutral, the brand ramp
          through it, and a red, binds every shadcn token, and shows you what
          clears. A draft lives only here until you save it as a brand.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-lg gap-4">
        <SeedPicker onPick={onPick} />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => file.current?.click()}>
            Open a brand file
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onOpen(e.target.files?.[0])}
          />
        </div>
      </EmptyContent>
    </Empty>
  );
}
