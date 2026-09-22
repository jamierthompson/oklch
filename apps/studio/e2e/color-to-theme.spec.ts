import { expect, test } from "@playwright/test";

/** The primary flow: a new theme, edited, with every change undoable, and passing shadcn files out. */
test("a new theme ships with every token clearing", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Theme list" });
  await expect(
    nav.getByRole("button", { name: "Kansas City Chiefs", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add theme" }).click();
  await expect(nav.getByRole("listitem").first()).toHaveText(
    /^[A-Z][a-z]+ [A-Z][a-z]+$/,
  );
  await page.getByLabel("Theme name").fill("Amber Co");
  const primary = page.getByLabel("Seeds").getByLabel("Primary color");
  await primary.fill("#f59e0b");
  await primary.press("Enter");
  await expect(primary).toHaveValue("#f59e0b");
  await expect(
    nav.getByRole("button", { name: "Amber Co", exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Palette" }).click();
  await expect(page.getByRole("tab", { name: "Palette" })).not.toContainText(
    "failing",
  );
  await expect(page.getByText(/^fails/)).toHaveCount(0);

  await page.getByRole("tab", { name: "Export" }).click();
  const css = page.getByLabel("css export");
  await expect(css).toContainText(":root {");
  await expect(css).toContainText("--primary: oklch(");
  await expect(css).toContainText(".dark {");
  await expect(css).toContainText("@theme inline {");

  await page.getByRole("tab", { name: "registry item" }).click();
  await expect(page.getByLabel("registry export")).toContainText(
    '"type": "registry:theme"',
  );
  await expect(page.getByLabel("registry export")).toContainText(
    '"name": "amber-co"',
  );

  await page.getByRole("tab", { name: "preset" }).click();
  await expect(page.getByLabel("preset export")).toContainText(
    'id: "amber-co"',
  );
});

test("a step moved off the bar is shown failing, export waits, and undo puts it back", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Theme list" })
    .getByRole("button", { name: "Kansas City Chiefs", exact: true })
    .click();
  await page.getByRole("tab", { name: "Palette" }).click();

  await page.getByRole("combobox", { name: "light primary step" }).click();
  await page.getByRole("option", { name: "100", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Palette" })).toContainText(
    "failing",
  );
  const row = page
    .getByRole("row")
    .filter({ has: page.getByText("primary", { exact: true }) });
  await expect(row.getByText(/^fails/)).toBeVisible();

  await page.getByRole("tab", { name: "Export" }).click();
  await expect(page.getByText("Nothing ships yet")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("tab", { name: "Palette" })).not.toContainText(
    "failing",
  );
  await expect(page.getByLabel("css export")).toContainText(":root {");

  // The change is in the activity log, undone, and can be redone from there.
  await page.getByRole("button", { name: "Activity" }).click();
  const feed = page.getByRole("dialog");
  await expect(feed.getByText("light primary step")).toBeVisible();
  await feed.getByRole("button", { name: /^Redo to here/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: "Palette" })).toContainText(
    "failing",
  );
});

test("a preset is deleted like any theme, and undo brings it back", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Theme list" });
  const steelers = nav.getByRole("button", {
    name: "Pittsburgh Steelers",
    exact: true,
  });
  await nav
    .getByRole("button", { name: "Pittsburgh Steelers actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(steelers).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(steelers).toBeVisible();
  await expect(page.getByLabel("Theme name")).toHaveValue(
    "Pittsburgh Steelers",
  );
});
