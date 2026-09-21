import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "./App.tsx";
import { SEEDS } from "@/lib/seeds.ts";

describe("App", () => {
  beforeEach(() => localStorage.clear());

  it("opens empty, with the seed colors and nothing created", () => {
    render(<App />);
    expect(screen.getByText("No brand yet")).toBeInTheDocument();
    for (const s of SEEDS)
      expect(screen.getByRole("button", { name: s.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    expect(screen.queryByTestId("preview-light")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-empty")).toBeInTheDocument();
    expect(localStorage.getItem("oklch-studio/brands")).toContain(
      '"brands":[]',
    );
  });

  it("creates a brand from a seed and lands in the workspace with both previews skinned", async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText("Name"), "Acme");
    await userEvent.click(screen.getByRole("button", { name: "Forest" }));
    expect(screen.getByLabelText("Or your own color")).toHaveValue("#059669");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByLabelText("Brand name")).toHaveValue("Acme");
    const light = screen.getByTestId("preview-light");
    const dark = screen.getByTestId("preview-dark");
    expect(light.style.getPropertyValue("--primary")).toMatch(/^oklch\(/);
    expect(dark).toHaveClass("dark");
    expect(light.style.getPropertyValue("--background")).not.toBe(
      dark.style.getPropertyValue("--background"),
    );
    const stored = JSON.parse(localStorage.getItem("oklch-studio/brands")!) as {
      brands: { name: string }[];
    };
    expect(stored.brands.map((b) => b.name)).toEqual(["Acme"]);
  });

  it("explains a seed that is not a color, and stays on the welcome", async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText("Or your own color"), "blueish");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByText(/"blueish" is not a color/)).toBeInTheDocument();
    expect(screen.getByText("No brand yet")).toBeInTheDocument();
  });
});
