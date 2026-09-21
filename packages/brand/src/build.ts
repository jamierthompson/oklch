import {
  tokenSetToDesignTokens,
  tokenSetToRegistryItem,
  tokenSetToShadcnCss,
  type TokenSetAudit,
} from "@jamiethompson/oklch";

import { auditOf, type Brand } from "./brand.js";

/** One file that ships: its name, contents, and media type. */
export interface Output {
  readonly file: string;
  readonly text: string;
  readonly type: string;
}

export interface Built {
  readonly audit: TokenSetAudit;
  /** The files, or null while any verdict is not `clears`. */
  readonly outputs: {
    readonly css: Output;
    readonly registry: Output;
    readonly dtcg: Output;
  } | null;
}

/** A kebab-case name for files and the registry, from the brand's name. */
export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "brand"
  );
}

/**
 * Audit the brand and, when every token clears, the three files it ships
 * as: shadcn's CSS blocks, a `registry:theme` item, and DTCG tokens. When
 * any verdict is not `clears`, `outputs` is null and the audit says which.
 */
export function buildBrand(brand: Brand): Built {
  const audit = auditOf(brand);
  if (audit.set === null) return { audit, outputs: null };
  const name = slug(brand.name);
  return {
    audit,
    outputs: {
      css: {
        file: `${name}.css`,
        text: tokenSetToShadcnCss(audit.set, { radius: brand.radius }),
        type: "text/css",
      },
      registry: {
        file: `${name}.registry.json`,
        text:
          JSON.stringify(
            tokenSetToRegistryItem(audit.set, { name, title: brand.name }),
            null,
            2,
          ) + "\n",
        type: "application/json",
      },
      dtcg: {
        file: `${name}.tokens.json`,
        text: JSON.stringify(tokenSetToDesignTokens(audit.set), null, 2) + "\n",
        type: "application/json",
      },
    },
  };
}

/** Every verdict that is not `clears`, one line each, for a terminal or a log. */
export function describeFailures(audit: TokenSetAudit): string[] {
  const lines = [...audit.problems];
  for (const a of [...audit.light, ...audit.dark]) {
    const o = a.outcome;
    if (o.kind === "fails") {
      lines.push(
        `${a.scheme}/${a.token} on ${o.on}: WCAG ${o.check.wcag.value.toFixed(2)} against ${o.target.wcag}, ` +
          `APCA ${o.check.apca.value.toFixed(1)} against ${o.target.apca}; does not clear`,
      );
    } else if (o.kind === "unresolved") {
      lines.push(`${a.scheme}/${a.token}: ${o.reason}`);
    }
  }
  return lines;
}
