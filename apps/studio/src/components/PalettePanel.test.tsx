import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PalettePanel, type PaletteActions } from "./PalettePanel.tsx";
import { STOP_NAMES } from "@/lib/format.ts";
import {
  auditOf,
  newTheme,
  withOverride,
  withPrimary,
  withStep,
  type Theme,
} from "@/lib/theme.ts";
import { parseColor } from "@jamiethompson/oklch";

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
/** Click a step: its ramp's popover opens on it. */
const openStep = async (name: string, step: number) => {
  await userEvent.click(
    ramp(name).getByRole("button", { name: `${name} ${STOP_NAMES[step]}` }),
  );
  return within(
    screen.getByRole("dialog", { name: `${name} ${STOP_NAMES[step]}` }),
  );
};
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
    // Nothing opens until a step is clicked.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
    const dialog = await openStep("primary", seed);
    fireEvent.change(dialog.getByLabelText("L value"), {
      target: { value: "0.5" },
    });
    const last = onStep.mock.calls.at(-1)!;
    expect(last[0]).toBe("primary");
    expect(last[1]).toBe(seed);
    expect(last[2].L).toBe(0.5);
  });

  it("the popover follows the step clicked, and closing it keeps the selection", async () => {
    panel(acme());
    const primary = ramp("primary");
    await openStep("primary", 3);
    await openStep("primary", 7);
    expect(
      screen.queryByRole("dialog", { name: "primary 300" }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      primary.getByRole("button", { name: "primary 700" }),
    ).toHaveAttribute("aria-pressed", "true");
    // A step on another ramp takes the popover with it.
    const dialog = await openStep("red", 5);
    expect(dialog.getByLabelText("L value")).toBeInTheDocument();
    expect(
      primary.getByRole("button", { name: "primary 700" }),
    ).toHaveAttribute("aria-pressed", "false");
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "show light primary on its ramp" }),
    );
    const theme = ramp("primary");
    expect(theme.getByRole("button", { name: "primary 800" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The step's popover opens where the token landed.
    const dialog = within(screen.getByRole("dialog", { name: "primary 800" }));
    const onStep = within(dialog.getByLabelText("tokens on this step"));
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
    const dialog = await openStep("primary", 1);
    const onStep = within(dialog.getByLabelText("tokens on this step"));
    expect(onStep.getByText("override")).toBeInTheDocument();
    expect(onStep.getByText(/^fails on background/)).toBeInTheDocument();
  });

  it("a solved token is marked solved where it landed", async () => {
    panel(acme());
    await userEvent.click(
      screen.getByRole("button", { name: "show light foreground on its ramp" }),
    );
    const onStep = within(
      within(screen.getByRole("dialog", { name: /^neutral / })).getByLabelText(
        "tokens on this step",
      ),
    );
    const row = onStep.getByText("light · foreground").parentElement!;
    expect(within(row).getByText("solved")).toBeInTheDocument();
  });

  it("the seed step has no reset: it is what the ramp is drawn through", async () => {
    const b = acme();
    const seed = b.ramps.find((r) => r.name === "primary")!.seed!;
    // Moved far enough that the seeds would anchor on another stop.
    const moved = withStep(b, "primary", seed, {
      ...b.ramps.find((r) => r.name === "primary")!.steps[seed]!,
      L: 0.5,
    });
    const { onStep } = panel(moved);
    const dialog = await openStep("primary", seed);
    const reset = dialog.getByRole("button", {
      name: `reset primary ${STOP_NAMES[seed]}`,
    });
    expect(reset).toBeDisabled();
    expect(reset).toHaveAttribute("title", expect.stringMatching(/the seed/));
    await userEvent.click(reset);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("a step moved on the primary is redrafted by a new primary seed, so there is nothing left to reset", async () => {
    const b = acme();
    const edited = withStep(b, "primary", 3, {
      ...b.ramps.find((r) => r.name === "primary")!.steps[3]!,
      L: 0.7,
    });
    const reseeded = withPrimary(edited, parseColor("#dc2626")!);
    panel(reseeded);
    expect(
      (await openStep("primary", 3)).getByRole("button", {
        name: "reset primary 300",
      }),
    ).toBeDisabled();
  });

  it("a step moved on red survives a new primary seed, and still resets", async () => {
    const b = acme();
    const draft = b.ramps.find((r) => r.name === "red")!.steps[3]!;
    const edited = withStep(b, "red", 3, { ...draft, L: 0.7 });
    const { onStep } = panel(withPrimary(edited, parseColor("#dc2626")!));
    await userEvent.click(
      (await openStep("red", 3)).getByRole("button", { name: "reset red 300" }),
    );
    expect(onStep).toHaveBeenCalledWith("red", 3, draft);
  });

  it("a moved step resets to where the seeds draft it, from its popover", async () => {
    const b = acme();
    const { onStep } = panel(withStep(b, "red", 3, { L: 0.8, C: 0.05, H: 25 }));
    expect(
      (await openStep("red", 5)).getByRole("button", { name: "reset red 500" }),
    ).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    const dialog = await openStep("red", 3);
    await userEvent.click(
      dialog.getByRole("button", { name: "reset red 300" }),
    );
    expect(onStep).toHaveBeenCalledWith(
      "red",
      3,
      b.ramps.find((r) => r.name === "red")!.steps[3],
    );
  });
});
