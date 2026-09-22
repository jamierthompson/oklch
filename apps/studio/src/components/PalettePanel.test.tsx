import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PalettePanel, type PaletteActions } from "./PalettePanel.tsx";
import { STOP_NAMES } from "@/lib/format.ts";
import { auditOf, newTheme, withOverride, type Theme } from "@/lib/theme.ts";

const acme = () => newTheme("Acme", "#2563eb", "srgb");
const panel = (theme: Theme) => {
  const actions = {
    onStep: vi.fn<PaletteActions["onStep"]>(),
    onRole: vi.fn<PaletteActions["onRole"]>(),
    onOverride: vi.fn<PaletteActions["onOverride"]>(),
  };
  render(
    <PalettePanel theme={theme} audit={auditOf(theme)} actions={actions} />,
  );
  return actions;
};
const ramp = (name: string) =>
  within(screen.getByRole("region", { name: `ramp ${name}` }));

describe("PalettePanel", () => {
  it("shows the seeds' ramps, the preview and the tokens together, with each ramp holding its roles", () => {
    panel(acme());
    expect(screen.getAllByRole("row")).toHaveLength(32);
    expect(screen.getByTestId("preview-light")).toBeInTheDocument();
    expect(screen.getByTestId("preview-dark")).toBeInTheDocument();
    for (const name of ["neutral", "primary", "red", "harmony-1", "harmony-2"])
      expect(
        screen.getByRole("region", { name: `ramp ${name}` }),
      ).toBeVisible();
    // No ramp is added or removed here: the seeds draw them all.
    expect(screen.queryByLabelText("add ramp")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
    const neutral = ramp("neutral");
    expect(
      neutral.getByRole("button", { name: "neutral role on neutral" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      neutral.getByRole("button", { name: "secondary role on neutral" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      ramp("primary").getByRole("button", { name: "primary role on primary" }),
    ).toHaveAttribute("aria-pressed", "true");
    // Accent and the second chart series default to the first harmony.
    expect(
      ramp("harmony-1").getByRole("button", {
        name: "accent role on harmony-1",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      ramp("harmony-1").getByRole("button", {
        name: "chart-2 role on harmony-1",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      ramp("primary").getByRole("button", { name: "accent role on primary" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("giving a chart series a ramp asks for that role on it", async () => {
    const { onRole } = panel(acme());
    await userEvent.click(
      ramp("red").getByRole("button", { name: "chart-2 role on red" }),
    );
    expect(onRole).toHaveBeenCalledWith("chart-2", "red");
  });

  it("clicking a role on a ramp gives that ramp the role", async () => {
    const { onRole } = panel(acme());
    await userEvent.click(
      ramp("primary").getByRole("button", { name: "accent role on primary" }),
    );
    expect(onRole).toHaveBeenCalledTimes(1);
    expect(onRole).toHaveBeenCalledWith("accent", "primary");
    // A role the ramp already plays is not re-sent.
    await userEvent.click(
      ramp("primary").getByRole("button", { name: "primary role on primary" }),
    );
    expect(onRole).toHaveBeenCalledTimes(1);
  });

  it("moving the selected step's channel asks for that step", async () => {
    const b = acme();
    const { onStep } = panel(b);
    const seed = b.ramps.find((r) => r.name === "primary")!.seed!;
    const l = ramp("primary").getByLabelText("L value");
    fireEvent.change(l, { target: { value: "0.5" } });
    const last = onStep.mock.calls.at(-1)!;
    expect(last[0]).toBe("primary");
    expect(last[1]).toBe(seed);
    expect(last[2].L).toBe(0.5);
  });

  it("a token's swatch selects the step it came from, and the step lists its tokens", async () => {
    const b = acme();
    panel(b);
    // Before: the default selection is the primary's seed step.
    const seed = b.ramps.find((r) => r.name === "primary")!.seed!;
    expect(
      ramp("primary").getByRole("button", {
        name: `primary ${STOP_NAMES[seed]}`,
      }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      screen.getByRole("button", { name: "show light primary on its ramp" }),
    );
    const theme = ramp("primary");
    expect(theme.getByRole("button", { name: "primary 800" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const onStep = within(theme.getByLabelText("tokens on this step"));
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
    const theme = ramp("primary");
    expect(theme.getByLabelText("1 token on primary 100")).toHaveClass(
      "text-destructive",
    );
    await userEvent.click(theme.getByRole("button", { name: "primary 100" }));
    const onStep = within(theme.getByLabelText("tokens on this step"));
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
