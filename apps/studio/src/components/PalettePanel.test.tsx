import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PalettePanel } from "./PalettePanel.tsx";
import { auditOf, newBrand, withOverride, type Brand } from "@/lib/brand.ts";

const acme = () => newBrand("Acme", "#2563eb", "srgb");
const panel = (brand: Brand, onUpdate = vi.fn<(b: Brand) => void>()) => {
  render(
    <PalettePanel brand={brand} audit={auditOf(brand)} onUpdate={onUpdate} />,
  );
  return onUpdate;
};
const ramp = (name: string) =>
  within(screen.getByRole("region", { name: `ramp ${name}` }));

describe("PalettePanel", () => {
  it("shows ramps and tokens together, with each ramp holding its roles", () => {
    panel(acme());
    expect(screen.getAllByRole("row")).toHaveLength(32);
    const neutral = ramp("neutral");
    expect(
      neutral.getByRole("button", { name: "neutral role on neutral" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      neutral.getByRole("button", { name: "accent role on neutral" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      ramp("brand").getByRole("button", { name: "primary role on brand" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      ramp("brand").getByRole("button", { name: "accent role on brand" }),
    ).toHaveAttribute("aria-pressed", "false");
    // The chart series default to the primary ramp.
    expect(
      ramp("brand").getByRole("button", { name: "chart-3 role on brand" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("giving a chart series a ramp moves that token to it", async () => {
    const onUpdate = panel(acme());
    await userEvent.click(
      ramp("red").getByRole("button", { name: "chart-2 role on red" }),
    );
    const next = onUpdate.mock.calls[0]![0];
    expect(next.assignment["chart-2"]).toBe("red");
    const chart2 = auditOf(next).light.find((a) => a.token === "chart-2")!;
    expect(chart2.binding.ramp).toBe("red");
  });

  it("clicking a role on a ramp gives that ramp the role", async () => {
    const onUpdate = panel(acme());
    await userEvent.click(
      ramp("brand").getByRole("button", { name: "accent role on brand" }),
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0]![0].assignment.accent).toBe("brand");
    // A role the ramp already plays is not re-sent.
    await userEvent.click(
      ramp("brand").getByRole("button", { name: "primary role on brand" }),
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("a token's swatch selects the step it came from, and the step lists its tokens", async () => {
    panel(acme());
    // Before: the default selection is the first ramp's middle step.
    expect(
      ramp("neutral").getByRole("button", { name: "neutral 500" }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      screen.getByRole("button", { name: "show light primary on its ramp" }),
    );
    const brand = ramp("brand");
    expect(brand.getByRole("button", { name: "brand 800" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      ramp("neutral").queryByRole("button", { name: "neutral 500" }),
    ).toHaveAttribute("aria-pressed", "false");
    const onStep = within(brand.getByLabelText("tokens on this step"));
    expect(onStep.getByText("light · primary")).toBeInTheDocument();
    expect(onStep.getByText(/on background · WCAG/)).toBeInTheDocument();
    // The cells on that step are marked.
    expect(document.getElementById("token-light-primary")).toHaveAttribute(
      "data-selected",
    );
    expect(document.getElementById("token-dark-primary")).not.toHaveAttribute(
      "data-selected",
    );
  });

  it("a step with a failing token is marked on the ramp, and the token says why", async () => {
    const failing = withOverride(acme(), "light", "primary", { step: 1 });
    panel(failing);
    const brand = ramp("brand");
    expect(brand.getByLabelText("1 token on brand 100")).toHaveClass(
      "text-destructive",
    );
    await userEvent.click(brand.getByRole("button", { name: "brand 100" }));
    const onStep = within(brand.getByLabelText("tokens on this step"));
    expect(onStep.getByText("override")).toBeInTheDocument();
    expect(onStep.getByText(/^fails on background/)).toBeInTheDocument();
  });

  it("a solved token is marked solved where it landed", async () => {
    panel(acme());
    await userEvent.click(
      screen.getByRole("button", { name: "show light foreground on its ramp" }),
    );
    const onStep = within(
      ramp("neutral").getByLabelText("tokens on this step"),
    );
    const row = onStep.getByText("light · foreground").parentElement!;
    expect(within(row).getByText("solved")).toBeInTheDocument();
  });
});
