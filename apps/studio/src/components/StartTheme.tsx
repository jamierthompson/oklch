import { SeedPicker } from "@/components/SeedPicker.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** The studio's empty state: nothing exists until a color is tried. */
export function StartTheme({
  onPick,
}: {
  onPick: (color: string) => string | null;
}) {
  return (
    <Empty className="min-h-[60vh] border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <span
            aria-hidden
            className="block size-6 rounded-full bg-[conic-gradient(in_oklch_longer_hue,oklch(0.7_0.15_0),oklch(0.7_0.15_360))]"
          />
        </EmptyMedia>
        <EmptyTitle>No theme yet</EmptyTitle>
        <EmptyDescription>
          Try a color. The studio drafts a neutral tinted to it, the primary
          ramp through it, a red, and the harmonies of its hue; binds every
          shadcn token; and shows you what clears. Then every step is yours to
          move. A draft lives only here until you save it as a theme.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-lg gap-4">
        <SeedPicker onPick={onPick} />
      </EmptyContent>
    </Empty>
  );
}
