import { expect, test } from "@playwright/test";

/** The primary flow: a color tried, a brand saved, a passing shadcn theme out. */
test("a brand color becomes a shadcn theme with every token clearing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("No brand yet")).toBeVisible();

  await page.getByLabel("Or your own color").fill("#f59e0b");
  await page.getByRole("button", { name: "Try" }).click();
  await expect(page.getByText("Draft · not saved")).toBeVisible();

  await page.getByLabel("Brand name").fill("Amber Co");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.getByText("Draft · not saved")).toHaveCount(0);
  await expect(page.getByLabel("Brand name")).toHaveValue("Amber Co");

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
});

test("a step moved off the bar is shown failing, and export waits", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ocean" }).click();
  await expect(page.getByText("Draft · not saved")).toBeVisible();
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

  await page.getByRole("tab", { name: "Palette" }).click();
  await row.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("tab", { name: "Palette" })).not.toContainText(
    "failing",
  );
});
