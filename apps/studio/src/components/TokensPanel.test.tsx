import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TokensPanel } from "./TokensPanel.tsx";
import { auditOf, newBrand, withOverride, type Brand } from "@/lib/brand.ts";

const acme = () => newBrand("Acme", "#2563eb", "srgb");
const rowOf = (token: string) =>
  screen
    .getAllByRole("row")
    .find((r) => r.querySelector("td")?.textContent === token)!;

describe("TokensPanel", () => {
  it("shows every token with a verdict in both schemes, on its role's ramp", () => {
    const brand = acme();
    render(
      <TokensPanel brand={brand} audit={auditOf(brand)} onUpdate={() => {}} />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(32);
    // The ramp is shown, not chosen: a token's ramp is its role's.
    expect(screen.queryAllByRole("combobox", { name: /ramp$/ })).toHaveLength(
      0,
    );
    expect(within(rowOf("primary")).getAllByText("brand")).toHaveLength(2);
    expect(within(rowOf("chart-2")).getAllByText("brand")).toHaveLength(2);
    const background = rowOf("background");
    expect(within(background).getAllByText("no pairing")).toHaveLength(2);
    const foreground = rowOf("foreground");
    expect(within(foreground).getAllByText(/WCAG 18\.96 ≥ 4\.5/)).toHaveLength(
      2,
    );
    expect(within(foreground).getAllByText("Aa")).toHaveLength(2);
  });

  it("shows a failing pick as failing, and Snap moves it to a step that clears", async () => {
    const failing = withOverride(acme(), "light", "primary", { step: 1 });
    const onUpdate = vi.fn<(b: Brand) => void>();
    render(
      <TokensPanel
        brand={failing}
        audit={auditOf(failing)}
        onUpdate={onUpdate}
      />,
    );
    const primary = rowOf("primary");
    expect(within(primary).getByText(/^fails/)).toBeInTheDocument();
    await userEvent.click(
      within(primary).getByRole("button", { name: "Snap" }),
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const next = onUpdate.mock.calls[0]![0];
    expect(next.overrides.light["primary"]).toEqual({
      step: expect.any(Number),
    });
    expect(
      auditOf(next).light.find((a) => a.token === "primary")!.outcome.kind,
    ).toBe("clears");
  });

  it("Reset drops the override", async () => {
    const picked = withOverride(acme(), "dark", "card", { step: 8 });
    const onUpdate = vi.fn<(b: Brand) => void>();
    render(
      <TokensPanel
        brand={picked}
        audit={auditOf(picked)}
        onUpdate={onUpdate}
      />,
    );
    await userEvent.click(
      within(rowOf("card")).getByRole("button", { name: "Reset" }),
    );
    expect(onUpdate.mock.calls[0]![0].overrides.dark).toEqual({});
  });
});
