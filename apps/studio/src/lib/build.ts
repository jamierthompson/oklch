import {
  tokenSetToDesignTokens,
  tokenSetToRegistryItem,
  tokenSetToShadcnCss,
  type TokenSetAudit,
} from "@jamiethompson/oklch";

import { auditOf, type Theme } from "./theme.ts";

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

/** A kebab-case name for files and the registry, from the theme's name. */
export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "theme"
  );
}

/**
 * Audit the theme and, when every token clears, the three files it ships
 * as: shadcn's CSS blocks, a `registry:theme` item, and DTCG tokens. When
 * any verdict is not `clears`, `outputs` is null and the audit says which.
 */
export function buildTheme(theme: Theme): Built {
  const audit = auditOf(theme);
  if (audit.set === null) return { audit, outputs: null };
  const name = slug(theme.name);
  return {
    audit,
    outputs: {
      css: {
        file: `${name}.css`,
        text: tokenSetToShadcnCss(audit.set, { radius: theme.radius }),
        type: "text/css",
      },
      registry: {
        file: `${name}.registry.json`,
        text:
          JSON.stringify(
            tokenSetToRegistryItem(audit.set, { name, title: theme.name }),
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
