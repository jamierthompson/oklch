import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SeedRail } from "./SeedRail.tsx";
import {
  newBrand,
  withHarmony,
  withSecondary,
  type Brand,
} from "@/lib/brand.ts";

const acme = () => newBrand("Acme", "#2563eb", "srgb");
const rail = (brand: Brand) => {
  const onUpdate = vi.fn<(b: Brand) => void>();
  render(<SeedRail brand={brand} onUpdate={onUpdate} />);
  return onUpdate;
};
const last = (f: ReturnType<typeof vi.fn<(b: Brand) => void>>) =>
  f.mock.calls.at(-1)![0];

describe("SeedRail", () => {
  it("shows the primary as hex and channels, and a typed color replaces it", async () => {
    const onUpdate = rail(acme());
    const primary = screen.getByLabelText("Primary color");
    expect(primary).toHaveValue("#2563eb");
    await userEvent.clear(primary);
    await userEvent.type(primary, "#059669{Enter}");
    const next = last(onUpdate);
    expect(next.primary.H).toBeCloseTo(163, 0);
    expect(
      next.ramps.find((r) => r.name === "primary")!.steps[5]!.H,
    ).toBeCloseTo(163, 0);
  });

  it("explains a typed color that is not one, and sends nothing", async () => {
    const onUpdate = rail(acme());
    const primary = screen.getByLabelText("Primary color");
    await userEvent.clear(primary);
    await userEvent.type(primary, "blueish{Enter}");
    expect(screen.getByText('"blueish" is not a color')).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("a channel typed past the safe chroma is clamped, not refused", async () => {
    const onUpdate = rail(acme());
    const c = screen.getByLabelText("C value");
    await userEvent.clear(c);
    await userEvent.type(c, "0.37");
    const next = last(onUpdate);
    expect(next.primary.C).toBeLessThan(0.37);
    expect(next.primary.C).toBeGreaterThan(0.1);
    expect(screen.queryByText(/safe chroma/)).not.toBeInTheDocument();
  });

  it("a secondary seed is optional: added by color, then removed", async () => {
    const onUpdate = rail(acme());
    expect(
      screen.queryByRole("button", { name: "Remove secondary" }),
    ).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Secondary color"),
      "#f59e0b{Enter}",
    );
    expect(last(onUpdate).ramps.map((r) => r.name)).toContain("secondary");
  });

  it("removing the secondary drops its ramp", async () => {
    const onUpdate = rail(withSecondary(acme(), { L: 0.7, C: 0.15, H: 70 }));
    expect(
      (screen.getByLabelText("Secondary color") as HTMLInputElement).value,
    ).toMatch(/^#/);
    await userEvent.click(
      screen.getByRole("button", { name: "Remove secondary" }),
    );
    expect(last(onUpdate).secondary).toBeNull();
    expect(last(onUpdate).ramps.map((r) => r.name)).not.toContain("secondary");
  });

  it("the harmony is a segmented choice that redraws the harmony ramps", async () => {
    const onUpdate = rail(acme());
    const harmony = within(screen.getByRole("group", { name: "Harmony" }));
    expect(harmony.getByRole("button", { name: "Analogous" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(harmony.getByRole("button", { name: "Tetradic" }));
    const next = last(onUpdate);
    expect(next.harmony).toBe("tetradic");
    expect(next.ramps.map((r) => r.name)).toEqual([
      "primary",
      "neutral",
      "red",
      "harmony-1",
      "harmony-2",
      "harmony-3",
    ]);
  });

  it("describes the chosen harmony, with its offsets", () => {
    rail(acme());
    expect(screen.getByText("-30°, +30°")).toBeInTheDocument();
    expect(screen.getByText(/The neighbours on the wheel/)).toBeInTheDocument();
    cleanup();
    rail(withHarmony(acme(), "tetradic"));
    expect(screen.getByText("+90°, +180°, +270°")).toBeInTheDocument();
    expect(screen.getByText(/Four hues at even quarters/)).toBeInTheDocument();
  });

  it("notes an achromatic primary", () => {
    rail(newBrand("Gray", "#808080", "srgb"));
    expect(screen.getByText(/The primary has no hue/)).toBeInTheDocument();
  });
});
