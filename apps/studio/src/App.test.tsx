import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "./App.tsx";
import { PRESETS } from "@/lib/presets.ts";

const stored = () =>
  JSON.parse(localStorage.getItem("oklch-studio/themes")!) as {
    themes: { name: string }[];
    log: unknown[];
    cursor: number;
  };
const sidebar = () =>
  within(screen.getByRole("navigation", { name: "Theme list" }));
/** The sidebar's theme names, top to bottom. */
const rows = () =>
  sidebar()
    .getAllByRole("listitem")
    .map((li) => li.querySelector("[data-sidebar=menu-button]")!.textContent);
const header = () => within(screen.getByRole("banner"));
const name = () => screen.getByLabelText("Theme name");
const menu = async (theme: string, item: string) => {
  await userEvent.click(
    sidebar().getByRole("button", { name: `${theme} actions` }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
};

describe("App", () => {
  beforeEach(() => localStorage.clear());

  it("opens on the presets, each a theme, with the first selected and stored", () => {
    render(<App />);
    // One read of the list, not a role query per preset: each walks the whole tree.
    expect(rows()).toEqual(PRESETS.map((t) => t.name));
    expect(name()).toHaveValue(PRESETS[0]!.name);
    expect(screen.getByTestId("preview-light")).toBeInTheDocument();
    expect(stored().themes).toHaveLength(32);
    expect(stored().log).toEqual([]);
    expect(header().getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("selecting a preset in the sidebar shows it", async () => {
    render(<App />);
    await userEvent.click(
      sidebar().getByRole("button", { name: "Kansas City Chiefs" }),
    );
    expect(name()).toHaveValue("Kansas City Chiefs");
    expect(
      within(screen.getByLabelText("Seeds")).getByLabelText("Primary color"),
    ).toHaveValue("#e31837");
  });

  it("a rename is applied at once, stored, and undone in one click, then redone", async () => {
    render(<App />);
    await userEvent.type(name(), " FC");
    expect(name()).toHaveValue(`${PRESETS[0]!.name} FC`);
    expect(stored().themes[0]!.name).toBe(`${PRESETS[0]!.name} FC`);
    expect(stored().log).toHaveLength(1);
    await userEvent.click(header().getByRole("button", { name: "Undo" }));
    expect(name()).toHaveValue(PRESETS[0]!.name);
    expect(header().getByRole("button", { name: "Undo" })).toBeDisabled();
    await userEvent.click(header().getByRole("button", { name: "Redo" }));
    expect(name()).toHaveValue(`${PRESETS[0]!.name} FC`);
  });

  it("+ adds a random theme at the top, selected; deleting needs no confirmation and undoes", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Add theme" }));
    const added = rows()[0]!;
    expect(added).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(name()).toHaveValue(added);
    expect(stored().themes).toHaveLength(33);
    expect(
      within(screen.getByLabelText("Seeds")).getByLabelText("Secondary color"),
    ).toBeInTheDocument();

    await menu(added, "Delete");
    expect(
      sidebar().queryByRole("button", { name: added }),
    ).not.toBeInTheDocument();
    expect(stored().themes).toHaveLength(32);
    await userEvent.click(header().getByRole("button", { name: "Undo" }));
    expect(rows()[0]).toBe(added);
    expect(name()).toHaveValue(added);
  });

  it("a preset is deleted like any theme, and undo brings it back", async () => {
    render(<App />);
    const first = PRESETS[0]!.name;
    await menu(first, "Delete");
    expect(name()).toHaveValue(PRESETS[1]!.name);
    expect(stored().themes).toHaveLength(31);
    await userEvent.click(header().getByRole("button", { name: "Undo" }));
    expect(rows()[0]).toBe(first);
    expect(name()).toHaveValue(first);
  });

  it("duplicate lands below the original, and the activity feed undoes to here", async () => {
    render(<App />);
    await menu(PRESETS[0]!.name, "Duplicate");
    expect(name()).toHaveValue(`${PRESETS[0]!.name} copy`);
    expect(rows().slice(0, 2)).toEqual([
      PRESETS[0]!.name,
      `${PRESETS[0]!.name} copy`,
    ]);
    await userEvent.type(name(), "!");

    await userEvent.click(header().getByRole("button", { name: "Activity" }));
    const feed = within(await screen.findByRole("dialog"));
    const items = feed.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Renamed")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Created")).toBeInTheDocument();
    // Undo to the creation: the rename goes with it, and both stay, undone.
    await userEvent.click(
      within(items[1]!).getByRole("button", { name: /^Undo to here/ }),
    );
    expect(feed.getAllByRole("listitem")).toHaveLength(2);
    expect(feed.getByRole("region", { name: "undone" })).toBeInTheDocument();
    expect(feed.getAllByRole("button", { name: /^Redo to here/ })).toHaveLength(
      2,
    );
    // The filter narrows to a theme, as a chip that can be removed.
    await userEvent.click(feed.getByRole("button", { name: "Filter" }));
    // Both entries are the copy's; with its creation undone, it goes by the name the log last saw.
    const copy = `${PRESETS[0]!.name} copy`;
    await userEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: copy }),
    );
    await userEvent.keyboard("{Escape}");
    expect(feed.getAllByRole("listitem")).toHaveLength(2);
    expect(
      feed.getAllByText(copy, { selector: "span" }).length,
    ).toBeGreaterThan(0);
    await userEvent.click(
      feed.getByRole("button", { name: `Remove filter ${copy}` }),
    );
    expect(feed.getAllByRole("listitem")).toHaveLength(2);
    await userEvent.keyboard("{Escape}");
    expect(
      sidebar().queryByRole("button", { name: /copy/ }),
    ).not.toBeInTheDocument();
    expect(name()).toHaveValue(PRESETS[0]!.name);
  });

  it("the undo button bounces on a change until undo is used once", async () => {
    render(<App />);
    const undo = () => header().getByRole("button", { name: "Undo" });
    expect(undo()).not.toHaveClass("motion-safe:animate-nudge");
    await userEvent.type(name(), "!");
    expect(undo()).toHaveClass("motion-safe:animate-nudge");
    await userEvent.click(undo());
    expect(localStorage.getItem("oklch-studio/knows-undo")).toBe("true");
    await userEvent.type(name(), "?");
    expect(undo()).not.toHaveClass("motion-safe:animate-nudge");
  });

  it("⌘Z undoes outside a field", async () => {
    render(<App />);
    await userEvent.click(
      within(screen.getByRole("region", { name: "ramp red" })).getByRole(
        "button",
        {
          name: "chart-2 role on red",
        },
      ),
    );
    expect(stored().log).toHaveLength(1);
    await userEvent.keyboard("{Meta>}z{/Meta}");
    expect(stored().cursor).toBe(0);
  });
});
