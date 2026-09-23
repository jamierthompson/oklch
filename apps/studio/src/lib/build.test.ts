import { describe, expect, it } from "vitest";

import { newTheme, withOverride } from "./theme.ts";
import { buildTheme, slug } from "./build.ts";

const acme = () => newTheme("Acme Corp", "#2563eb", "srgb");

describe("buildTheme", () => {
  it("ships three files named for the theme when every token clears", () => {
    const built = buildTheme(acme());
    expect(built.audit.passes).toBe(true);
    expect(built.outputs).not.toBeNull();
    const { css, registry, dtcg } = built.outputs!;
    expect(css.file).toBe("acme-corp.css");
    expect(css.text).toMatch(
      /^:root \{\n {2}--radius: 0.625rem;\n {2}--background: oklch\(/,
    );
    expect(css.text).toContain("@theme inline {");
    expect(registry.file).toBe("acme-corp.registry.json");
    const item = JSON.parse(registry.text) as {
      name: string;
      title: string;
      type: string;
    };
    expect(item).toMatchObject({
      name: "acme-corp",
      title: "Acme Corp",
      type: "registry:theme",
    });
    expect(dtcg.file).toBe("acme-corp.tokens.json");
    expect(Object.keys(JSON.parse(dtcg.text) as object)).toEqual([
      "light",
      "dark",
    ]);
  });

  it("ships nothing while a token fails, and says which", () => {
    const failing = withOverride(acme(), "light", "primary", { step: 1 });
    const built = buildTheme(failing);
    expect(built.outputs).toBeNull();
    const failures = [...built.audit.light, ...built.audit.dark].filter(
      (a) => a.outcome.kind !== "clears",
    );
    expect(failures.map((a) => `${a.scheme}/${a.token}`)).toEqual([
      "light/primary",
    ]);
  });

  it("slugs a name", () => {
    expect(slug("  Acme  Corp! ")).toBe("acme-corp");
    expect(slug("!!!")).toBe("theme");
  });
});
