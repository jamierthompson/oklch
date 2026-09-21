import { describe, expect, it } from "vitest";

import { newBrand, withOverride } from "./brand.js";
import { buildBrand, describeFailures, slug } from "./build.js";

const acme = () => newBrand("Acme Corp", "#2563eb", "srgb");

describe("buildBrand", () => {
  it("ships three files named for the brand when every token clears", () => {
    const built = buildBrand(acme());
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
    const failing = withOverride(acme(), "light", "primary", {
      ramp: "brand",
      step: 1,
    });
    const built = buildBrand(failing);
    expect(built.outputs).toBeNull();
    const lines = describeFailures(built.audit);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^light\/primary on background: WCAG \d\.\d\d against 3, APCA [\d.]+ against 30; does not clear$/,
    );
  });

  it("slugs a name", () => {
    expect(slug("  Acme  Corp! ")).toBe("acme-corp");
    expect(slug("!!!")).toBe("brand");
  });
});
