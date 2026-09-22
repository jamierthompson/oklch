import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SeedRail } from "./SeedRail.tsx";
import {
  newTheme,
  withHarmony,
  withPrimary,
  withSecondary,
  type Theme,
  type HarmonyKind,
} from "@/lib/theme.ts";

import type { OkLCH } from "@jamiethompson/oklch";

const acme = () => newTheme("Acme", "#2563eb", "srgb");
/** The rail with callbacks that answer as the studio would: the theme's own refusal, or none. */
const rail = (theme: Theme) => {
  const refusal = (f: () => Theme) => {
    try {
      f();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };
  const onPrimary = vi.fn((c: OkLCH) => refusal(() => withPrimary(theme, c)));
  const onSecondary = vi.fn((c: OkLCH | null) =>
    refusal(() => withSecondary(theme, c)),
  );
  const onHarmony = vi.fn((k: HarmonyKind) =>
    refusal(() => withHarmony(theme, k)),
  );
  render(
    <SeedRail
      theme={theme}
      onPrimary={onPrimary}
      onSecondary={onSecondary}
      onHarmony={onHarmony}
    />,
  );
  return { onPrimary, onSecondary, onHarmony };
};
const last = <T,>(f: { mock: { calls: T[][] } }) => f.mock.calls.at(-1)![0]!;

describe("SeedRail", () => {
  it("shows the primary as hex and channels, and a typed color replaces it", async () => {
    const { onPrimary } = rail(acme());
    const primary = screen.getByLabelText("Primary color");
    expect(primary).toHaveValue("#2563eb");
    await userEvent.clear(primary);
    await userEvent.type(primary, "#059669{Enter}");
    expect(last(onPrimary).H).toBeCloseTo(163, 0);
  });

  it("shows the primary ramp live at the top", () => {
    rail(acme());
    expect(
      screen.getByRole("img", { name: "primary ramp" }).children,
    ).toHaveLength(11);
  });

  it("explains a typed color that is not one, and sends nothing", async () => {
    const { onPrimary } = rail(acme());
    const primary = screen.getByLabelText("Primary color");
    await userEvent.clear(primary);
    await userEvent.type(primary, "blueish{Enter}");
    expect(screen.getByText('"blueish" is not a color')).toBeInTheDocument();
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it("a channel typed past the safe chroma is clamped, not refused", async () => {
    const { onPrimary } = rail(acme());
    const c = screen.getByLabelText("C value");
    await userEvent.clear(c);
    await userEvent.type(c, "0.37");
    expect(last(onPrimary).C).toBeLessThan(0.37);
    expect(last(onPrimary).C).toBeGreaterThan(0.1);
    expect(screen.queryByText(/safe chroma/)).not.toBeInTheDocument();
  });

  it("a secondary seed is optional: added by color, then removed", async () => {
    const { onSecondary } = rail(acme());
    expect(
      screen.queryByRole("button", { name: "Remove secondary" }),
    ).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Secondary color"),
      "#f59e0b{Enter}",
    );
    expect(last(onSecondary)!.H).toBeCloseTo(70, 0);
  });

  it("removing the secondary sends none", async () => {
    const { onSecondary } = rail(
      withSecondary(acme(), { L: 0.7, C: 0.15, H: 70 }),
    );
    expect(
      (screen.getByLabelText("Secondary color") as HTMLInputElement).value,
    ).toMatch(/^#/);
    await userEvent.click(
      screen.getByRole("button", { name: "Remove secondary" }),
    );
    expect(onSecondary).toHaveBeenCalledWith(null);
  });

  it("the harmony is a segmented choice", async () => {
    const { onHarmony } = rail(acme());
    const harmony = within(screen.getByRole("group", { name: "Harmony" }));
    expect(harmony.getByRole("button", { name: "Analogous" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(harmony.getByRole("button", { name: "Tetradic" }));
    expect(onHarmony).toHaveBeenCalledWith("tetradic");
  });

  it("describes the chosen harmony, with its offsets", () => {
    rail(acme());
    expect(screen.getByText("-30°, +30°")).toBeInTheDocument();
    expect(screen.getByText(/The neighbors on the wheel/)).toBeInTheDocument();
    cleanup();
    rail(withHarmony(acme(), "tetradic"));
    expect(screen.getByText("+90°, +180°, +270°")).toBeInTheDocument();
    expect(screen.getByText(/Four hues at even quarters/)).toBeInTheDocument();
  });

  it("notes an achromatic primary", () => {
    rail(newTheme("Gray", "#808080", "srgb"));
    expect(screen.getByText(/The primary has no hue/)).toBeInTheDocument();
  });
});
