import { auditOf, newTheme, withOverride } from "@/lib/theme.ts";
import { describe, expect, it } from "vitest";

import { landedOn, usageOf, usedBy } from "./usage.ts";

const acme = () => newTheme("Acme", "#2563eb", "srgb");

describe("usageOf", () => {
  it("maps each step to the tokens that landed on it, picked or solved", () => {
    const audit = auditOf(acme());
    const usage = usageOf(audit);
    const names = (ramp: string, step: number) =>
      usedBy(usage, { ramp, step }).map((a) => `${a.scheme}/${a.token}`);
    // The light page surface is neutral-50, and the dark inks solve to it.
    expect(names("neutral", 0)).toEqual(
      expect.arrayContaining(["light/background", "dark/foreground"]),
    );
    // Primary is picked at primary-800 in light.
    expect(names("primary", 8)).toContain("light/primary");
    // A step nothing lands on has no tokens.
    expect(names("red", 0)).toEqual([]);
  });

  it("skips a token with no color, and reports where a solve landed", () => {
    // A red step 0 on background does not clear, so every ink on it stays unresolved? No:
    // a failing pick keeps its color. Only a solve with no clearing step is unresolved.
    const theme = withOverride(acme(), "light", "foreground", { step: 1 });
    const audit = auditOf(theme);
    const foreground = audit.light.find((a) => a.token === "foreground")!;
    expect(foreground.outcome.kind).toBe("fails");
    expect(landedOn(foreground)).toEqual({ ramp: "neutral", step: 1 });
    const solved = audit.light.find((a) => a.token === "muted-foreground")!;
    expect(landedOn(solved)).toEqual({
      ramp: "neutral",
      step: expect.any(Number),
    });
    const unresolved = audit.light.find((a) => a.outcome.kind === "unresolved");
    if (unresolved !== undefined) expect(landedOn(unresolved)).toBeNull();
  });
});
