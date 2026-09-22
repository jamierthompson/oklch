import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "./App.tsx";
import { SEEDS } from "@/lib/seeds.ts";

const storedNames = () =>
  (
    JSON.parse(localStorage.getItem("oklch-studio/themes")!) as {
      themes: { name: string }[];
    }
  ).themes.map((b) => b.name);

describe("App", () => {
  beforeEach(() => localStorage.clear());

  it("opens empty, with the seed colors and nothing created", () => {
    render(<App />);
    expect(screen.getByText("No theme yet")).toBeInTheDocument();
    for (const s of SEEDS)
      expect(screen.getByRole("button", { name: s.name })).toBeInTheDocument();
    expect(screen.queryByTestId("preview-light")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Seeds")).not.toBeInTheDocument();
    expect(storedNames()).toEqual([]);
  });

  it("trying a seed drafts a whole palette in memory, and stores nothing", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Forest" }));
    expect(screen.getByText("Draft · not saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Theme name")).toHaveValue("Forest");
    const light = screen.getByTestId("preview-light");
    const dark = screen.getByTestId("preview-dark");
    expect(light.style.getPropertyValue("--primary")).toMatch(/^oklch\(/);
    expect(dark).toHaveClass("dark");
    expect(storedNames()).toEqual([]);
    // The rail shows the seed the draft was drawn through.
    const rail = within(screen.getByLabelText("Seeds"));
    expect(rail.getByLabelText("Primary color")).toHaveValue(
      SEEDS.find((s) => s.name === "Forest")!.color,
    );
    expect(rail.getByRole("button", { name: "Analogous" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The seeds stay in the header, and the one the draft came from is marked.
    expect(screen.getByRole("button", { name: "Forest" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Ocean" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("trying another seed replaces an untouched draft without asking", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Forest" }));
    await userEvent.click(screen.getByRole("button", { name: "Coral" }));
    expect(screen.getByLabelText("Theme name")).toHaveValue("Coral");
    expect(
      screen.queryByText("Replace the edited draft?"),
    ).not.toBeInTheDocument();
    expect(storedNames()).toEqual([]);
  });

  it("asks before replacing a draft that was edited", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Forest" }));
    await userEvent.type(screen.getByLabelText("Theme name"), " Co");
    await userEvent.click(screen.getByRole("button", { name: "Coral" }));
    expect(
      await screen.findByText("Replace the edited draft?"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Theme name")).toHaveValue("Forest Co");
    await userEvent.click(screen.getByRole("button", { name: "Coral" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Replace draft" }),
    );
    expect(screen.getByLabelText("Theme name")).toHaveValue("Coral");
  });

  it("saving the draft is what stores a theme; discarding returns to empty", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Ocean" }));
    await userEvent.clear(screen.getByLabelText("Theme name"));
    await userEvent.type(screen.getByLabelText("Theme name"), "Acme");
    await userEvent.click(screen.getByRole("button", { name: "Save theme" }));
    expect(storedNames()).toEqual(["Acme"]);
    expect(screen.queryByText("Draft · not saved")).not.toBeInTheDocument();
    // The preview has a Delete button of its own; the header's is the one that acts.
    const header = () => within(screen.getByRole("banner"));
    expect(
      header().getByRole("button", { name: "Delete" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Plum" }));
    expect(screen.getByText("Draft · not saved")).toBeInTheDocument();
    expect(storedNames()).toEqual(["Acme"]);
    await userEvent.click(
      screen.getByRole("button", { name: "Discard draft" }),
    );
    expect(screen.getByLabelText("Theme name")).toHaveValue("Acme");

    await userEvent.click(header().getByRole("button", { name: "Delete" }));
    expect(screen.getByText("No theme yet")).toBeInTheDocument();
    expect(storedNames()).toEqual([]);
  });

  it("explains a color that is not one, and stays empty", async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText("Or your own color"), "blueish");
    await userEvent.click(screen.getByRole("button", { name: "Try" }));
    expect(screen.getByText(/"blueish" is not a color/)).toBeInTheDocument();
    expect(screen.getByText("No theme yet")).toBeInTheDocument();
  });
});
