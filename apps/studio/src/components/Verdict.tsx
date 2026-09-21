import type { TokenAudit } from "@jamiethompson/oklch";

import { Badge } from "@/components/ui/badge";
import { fixed } from "@/lib/format.ts";

/** One token's verdict on its surface, with both standards named. */
export function Verdict({ a }: { a: TokenAudit }) {
  const o = a.outcome;
  if (o.kind === "unresolved") {
    return (
      <Badge variant="destructive" title={o.reason}>
        unresolved
      </Badge>
    );
  }
  if (o.kind === "fails") {
    return (
      <Badge variant="destructive" title={`on ${o.on}`}>
        fails on {o.on} · WCAG {fixed(o.check.wcag.value, 2)} / {o.target.wcag}{" "}
        · APCA {fixed(o.check.apca.value, 0)} / {o.target.apca}
      </Badge>
    );
  }
  const r = o.resolved.receipt;
  if (r === null) return <Badge variant="outline">no pairing</Badge>;
  return (
    <Badge variant="secondary" title={`on ${r.on}`}>
      on {r.on} · WCAG {fixed(r.wcag.value, 2)} ≥ {r.target.wcag} · APCA{" "}
      {fixed(r.apca.value, 0)} ≥ {r.target.apca}
    </Badge>
  );
}
