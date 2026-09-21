import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "./App.tsx";

describe("App", () => {
  beforeEach(() => localStorage.clear());

  it("opens on a seeded brand with both previews skinned", () => {
    render(<App />);
    expect(screen.getByDisplayValue("Acme")).toBeInTheDocument();
    const light = screen.getByTestId("preview-light");
    const dark = screen.getByTestId("preview-dark");
    expect(light.style.getPropertyValue("--primary")).toMatch(/^oklch\(/);
    expect(dark.style.getPropertyValue("--primary")).toMatch(/^oklch\(/);
    expect(light.style.getPropertyValue("--background")).not.toBe(
      dark.style.getPropertyValue("--background"),
    );
    expect(dark).toHaveClass("dark");
  });

  it("persists the brand list", () => {
    render(<App />);
    const stored = JSON.parse(localStorage.getItem("oklch-studio/brands")!) as {
      brands: { name: string }[];
    };
    expect(stored.brands.map((b) => b.name)).toEqual(["Acme"]);
  });
});
