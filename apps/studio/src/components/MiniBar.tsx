import { formatOklch } from "@jamiethompson/oklch";

import { swatchesOf, type Theme } from "@/lib/theme.ts";

/** A theme in one glance: its primary, the secondary's tint, and the first accent. */
export function MiniBar({
  theme,
  className = "",
}: {
  theme: Theme;
  className?: string;
}) {
  const [p, s, a] = swatchesOf(theme);
  return (
    <span
      aria-hidden
      className={`grid size-4 shrink-0 grid-cols-[2fr_1fr_1fr] overflow-hidden rounded-sm border ${className}`}
    >
      <i style={{ background: formatOklch(p) }} />
      <i style={{ background: formatOklch(s) }} />
      <i style={{ background: formatOklch(a) }} />
    </span>
  );
}
