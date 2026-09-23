import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PalettePanel, type PaletteActions } from "./PalettePanel.tsx";
import { STOP_NAMES } from "@/lib/format.ts";
import {
  auditOf,
  newTheme,
  safeSeed,
  withOverride,
  withRamp,
  withRecipe,
  withRole,
  type Recipe,
  type Theme,
} from "@/lib/theme.ts";
import { parseColor } from "@jamiethompson/oklch";

const acme = () => newTheme("Acme", "#2563eb", "srgb");
const teal: Recipe = {
  kind: "through",
  color: safeSeed(parseColor("#14b8a6")!, "srgb"),
  stops: "chromatic",
};
const panel = (theme: Theme) => {
  const actions = {
    onStep: vi.fn<PaletteActions["onStep"]>(),
    onRole: vi.fn<PaletteActions["onRole"]>(),
    onRedraw: vi.fn<PaletteActions["onRedraw"]>(() => null),
    onAddRamp: vi.fn<PaletteActions["onAddRamp"]>(() => null),
    onRemoveRamp: vi.fn<PaletteActions["onRemoveRamp"]>(() => null),
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
    // The seeds' ramps cannot be removed; a ramp can be added.
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "add ramp" })).toBeVisible();
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

  it("adding a ramp asks for it by name, drawn through the color typed", async () => {
    const { onAddRamp } = panel(acme());
    const add = within(screen.getByRole("region", { name: "add ramp" }));
    const draw = add.getByRole("button", { name: "Draw" });
    expect(draw).toBeDisabled();
    await userEvent.type(add.getByLabelText("Add a ramp"), "teal");
    await userEvent.type(add.getByLabelText("Through a color"), "not a color");
    await userEvent.click(draw);
    expect(add.getByText('"not a color" is not a color')).toBeInTheDocument();
    expect(onAddRamp).not.toHaveBeenCalled();
    await userEvent.clear(add.getByLabelText("Through a color"));
    await userEvent.type(add.getByLabelText("Through a color"), "#14b8a6");
    await userEvent.click(draw);
    expect(onAddRamp).toHaveBeenCalledWith("teal", {
      kind: "through",
      color: parseColor("#14b8a6"),
      stops: "chromatic",
    });
    // The form clears once the ramp is taken.
    expect(add.getByLabelText("Add a ramp")).toHaveValue("");
  });

  it("a refused ramp says why, and the form keeps what was typed", async () => {
    const { onAddRamp } = panel(acme());
    onAddRamp.mockReturnValue('a ramp named "teal" already exists');
    const add = within(screen.getByRole("region", { name: "add ramp" }));
    await userEvent.type(add.getByLabelText("Add a ramp"), "teal");
    await userEvent.type(add.getByLabelText("Through a color"), "#14b8a6");
    await userEvent.click(add.getByRole("button", { name: "Draw" }));
    expect(
      add.getByText('a ramp named "teal" already exists'),
    ).toBeInTheDocument();
    expect(add.getByLabelText("Add a ramp")).toHaveValue("teal");
  });

  it("the redraw drawer redraws a seeds' ramp by a recipe of the eye's, and hands it back", async () => {
    const { onRedraw } = panel(acme());
    const red = ramp("red");
    await userEvent.click(red.getByText("Redraw the ramp"));
    const drawer = within(red.getByRole("group", { name: "redraw red" }));
    expect(drawer.getByText(/Drawn by the seeds/)).toBeInTheDocument();
    expect(
      drawer.queryByRole("button", { name: "Back to the seeds" }),
    ).not.toBeInTheDocument();
    fireEvent.change(drawer.getByLabelText("hue value"), {
      target: { value: "10" },
    });
    expect(onRedraw).toHaveBeenLastCalledWith("red", {
      kind: "hue",
      hue: 10,
      saturation: 0.85,
      stops: "chromatic",
    });
    // Redraw runs the recipe as it stands, dropping the eye's moves.
    await userEvent.click(drawer.getByRole("button", { name: "Redraw" }));
    expect(onRedraw).toHaveBeenLastCalledWith("red", {
      kind: "hue",
      hue: 25,
      saturation: 0.85,
      stops: "chromatic",
    });
  });

  it("a ramp the eye redrew says so and can go back to the seeds", async () => {
    const own: Recipe = {
      kind: "hue",
      hue: 10,
      saturation: 0.9,
      stops: "chromatic",
    };
    const { onRedraw } = panel(withRecipe(acme(), "red", own));
    const red = ramp("red");
    await userEvent.click(red.getByText("Redraw the ramp"));
    const drawer = within(red.getByRole("group", { name: "redraw red" }));
    expect(drawer.getByText(/Drawn by hand/)).toBeInTheDocument();
    await userEvent.click(
      drawer.getByRole("button", { name: "Back to the seeds" }),
    );
    expect(onRedraw).toHaveBeenLastCalledWith("red", null);
  });

  it("the primary is drawn through its seed: its drawer only redraws from the seed", async () => {
    const { onRedraw } = panel(acme());
    const primary = ramp("primary");
    await userEvent.click(primary.getByText("Redraw the ramp"));
    const drawer = within(
      primary.getByRole("group", { name: "redraw primary" }),
    );
    expect(drawer.queryByLabelText("hue value")).not.toBeInTheDocument();
    await userEvent.click(
      drawer.getByRole("button", { name: "Redraw from the seed" }),
    );
    expect(onRedraw).toHaveBeenCalledWith("primary", null);
  });

  it("an added ramp can be removed, unless it plays a role", async () => {
    const added = withRamp(acme(), "teal", teal);
    const { onRemoveRamp } = panel(added);
    const tealRamp = ramp("teal");
    await userEvent.click(tealRamp.getByText("Redraw the ramp"));
    const drawer = within(tealRamp.getByRole("group", { name: "redraw teal" }));
    expect(drawer.getByText(/Added by hand/)).toBeInTheDocument();
    expect(
      drawer.queryByRole("button", { name: "Back to the seeds" }),
    ).not.toBeInTheDocument();
    await userEvent.click(drawer.getByRole("button", { name: "Remove" }));
    expect(onRemoveRamp).toHaveBeenCalledWith("teal");
  });

  it("an added ramp that plays a role cannot be removed until the role moves", async () => {
    const { onRemoveRamp } = panel(
      withRole(withRamp(acme(), "teal", teal), "accent", "teal"),
    );
    const tealRamp = ramp("teal");
    expect(
      tealRamp.getByRole("button", { name: "accent role on teal" }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(tealRamp.getByText("Redraw the ramp"));
    const remove = within(
      tealRamp.getByRole("group", { name: "redraw teal" }),
    ).getByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute(
      "title",
      expect.stringMatching(/plays accent/),
    );
    expect(onRemoveRamp).not.toHaveBeenCalled();
  });
});
