import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TokensPanel } from "./TokensPanel.tsx";
import {
  auditOf,
  newTheme,
  withOverride,
  type Override,
  type Scheme,
} from "@/lib/theme.ts";

type OnOverride = (scheme: Scheme, token: string, o: Override | null) => void;

const acme = () => newTheme("Acme", "#2563eb", "srgb");
const rowOf = (token: string) =>
  screen
    .getAllByRole("row")
    .find((r) => r.querySelector("td")?.textContent === token)!;

describe("TokensPanel", () => {
  it("shows every token with a verdict in both schemes, on its role's ramp", () => {
    const theme = acme();
    render(
      <TokensPanel
        theme={theme}
        audit={auditOf(theme)}
        onOverride={() => {}}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(32);
    // The ramp is shown, not chosen: a token's ramp is its role's.
    expect(screen.queryAllByRole("combobox", { name: /ramp$/ })).toHaveLength(
      0,
    );
    expect(
      within(rowOf("primary")).getAllByTitle(/is on the primary ramp/),
    ).toHaveLength(2);
    expect(
      within(rowOf("chart-2")).getAllByTitle(/is on the harmony-1 ramp/),
    ).toHaveLength(2);
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
    const onOverride = vi.fn<OnOverride>();
    render(
      <TokensPanel
        theme={failing}
        audit={auditOf(failing)}
        onOverride={onOverride}
      />,
    );
    const primary = rowOf("primary");
    expect(within(primary).getByText(/^fails/)).toBeInTheDocument();
    await userEvent.click(
      within(primary).getByRole("button", { name: "Snap" }),
    );
    expect(onOverride).toHaveBeenCalledTimes(1);
    const [scheme, token, snapped] = onOverride.mock.calls[0]!;
    expect([scheme, token]).toEqual(["light", "primary"]);
    expect(snapped).toEqual({ step: expect.any(Number) });
    const next = withOverride(failing, scheme, token, snapped);
    expect(
      auditOf(next).light.find((a) => a.token === "primary")!.outcome.kind,
    ).toBe("clears");
  });

  it("Reset drops the override", async () => {
    const picked = withOverride(acme(), "dark", "card", { step: 8 });
    const onOverride = vi.fn<OnOverride>();
    render(
      <TokensPanel
        theme={picked}
        audit={auditOf(picked)}
        onOverride={onOverride}
      />,
    );
    await userEvent.click(
      within(rowOf("card")).getByRole("button", { name: "Reset" }),
    );
    expect(onOverride).toHaveBeenCalledWith("dark", "card", null);
  });
});
