import { formatOklch, type OkLCH } from "@jamiethompson/oklch";

import { cn } from "cn";

/** A color, or an ink on its surface. */
export function Swatch({
  color,
  on,
  className,
  title,
}: {
  color: OkLCH | null;
  on?: OkLCH | null;
  className?: string;
  title?: string;
}) {
  if (color === null) {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-12 items-center justify-center rounded-md border border-dashed border-destructive text-xs text-destructive",
          className,
        )}
        title={title}
      >
        —
      </span>
    );
  }
  if (on === undefined || on === null) {
    return (
      <span
        className={cn("inline-block h-8 w-12 rounded-md border", className)}
        style={{ background: formatOklch(color) }}
        title={title}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-8 w-12 items-center justify-center rounded-md border text-sm font-semibold",
        className,
      )}
      style={{ background: formatOklch(on), color: formatOklch(color) }}
      title={title}
    >
      Aa
    </span>
  );
}
