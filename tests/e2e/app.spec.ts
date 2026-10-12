import { test, expect } from "@playwright/test";
test("hero guide tabs, favorites, drill and notes persist offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await page.getByRole("textbox", { name: "Filter heroes" }).fill("Ana");
  await page.getByRole("button", { name: "Ana", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ana", exact: true }),
  ).toBeVisible();
  for (const tab of ["Overview", "Abilities", "Matchups", "Maps", "Strategy"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  }
  const drill = page
    .getByRole("checkbox", { name: "Completed", exact: true })
    .first();
  await drill.click();
  await expect(drill).toBeChecked();
  await page.getByRole("button", { name: "Add favorite", exact: true }).click();
  await page
    .getByRole("button", { name: "Personal notes", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your note", exact: true })
    .fill("Wait for dive. Keep cover.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Note saved");
  await context.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.reload();
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Note subject", exact: true })
    .selectOption("ana");
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Wait for dive. Keep cover.");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByText("Completed practice drills")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ana support/ })).toHaveCount(
    2,
  );
});
test("counter picker explains current editorial scores and unknowns", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Counter Picker", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Enemy team (0/5)" })
    .selectOption("pharah");
  await expect(page.locator(".recommendation").first()).toContainText("+2");
  await expect(page.locator(".recommendation").first()).toContainText(
    "low confidence",
  );
  await page
    .getByRole("checkbox", { name: "Include archived advice", exact: false })
    .check();
  await expect(
    page.locator(".recommendation").filter({ hasText: "D.Va" }),
  ).toContainText("+2");
  await expect(page.locator(".recommendation").first()).toContainText("+2");
  await expect(page.locator(".recommendation").first()).toContainText(
    "low confidence",
  );
  await page
    .getByRole("button", { name: "Remove Pharah", exact: true })
    .click();
  await expect(
    page.getByText("Select an opponent", { exact: false }),
  ).toBeVisible();
});
test("map fallback, modes, comparisons and search work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Maps", exact: true }).click();
  await page.getByLabel("Find map").fill("Dorado");
  await page
    .getByRole("button", { name: "Dorado escort", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Text field guide" }),
  ).toBeVisible();
  await expect(
    page.getByText("No geometry or tactical locations have been invented.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search all guides" })
    .fill("Sleep Dart");
  await page.getByRole("button", { name: "Ana · Sleep Dart hero" }).click();
  await expect(
    page.getByRole("heading", { name: "Ana", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Compare hero", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Compare heroes" })
    .selectOption("winston");
  await expect(page.locator(".comparison .card")).toHaveCount(2);
  await page.setViewportSize({ width: 1000, height: 650 });
  await expect(page.locator(".comparison")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});
test("settings, import errors and keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Theme", exact: true })
    .selectOption("light");
  await expect(page.locator(".app")).toHaveClass(/theme-light/);
  await page
    .getByRole("combobox", { name: "Motion", exact: true })
    .selectOption("reduced");
  await page.reload();
  await expect(page.locator(".app")).toHaveClass(/motion-reduced/);
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await page.locator(".hero-tile").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tablist")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("textbox", { name: "Search all guides" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("status")).toContainText("Import failed");
});
test("quick reference is independently resizable and navigable", async ({
  page,
}) => {
  await page.goto("/?quick=1");
  await page.setViewportSize({ width: 420, height: 600 });
  await page
    .getByRole("combobox", { name: "Hero", exact: true })
    .selectOption("winston");
  await expect(
    page.getByRole("heading", { name: "Winston", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Abilities", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tesla Cannon", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 400 });
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("compact notes save and browser window changes are synchronized", async ({
  page,
  context,
}) => {
  await page.goto("/?quick=1");
  await page.getByRole("heading", { name: "Ana", exact: true }).waitFor();
  await expect(
    page.getByRole("button", { name: "Compare hero", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Personal notes", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your note", exact: true })
    .fill("Compact note persisted.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Note saved");
  const main = await context.newPage();
  await main.goto("/");
  await main.getByRole("button", { name: "Notebook", exact: true }).click();
  await main
    .getByRole("combobox", { name: "Note subject", exact: true })
    .selectOption("ana");
  await expect(
    main.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Compact note persisted.");
});

test("named strategies, guide bookmarks and map bookmarks persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New strategy title", exact: true })
    .fill("Hold together");
  await page
    .getByRole("button", { name: "Create strategy", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your note", exact: true })
    .fill("Wait for everyone before the next fight.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Note saved");
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Filter heroes", exact: true })
    .fill("Ana");
  await page.getByRole("button", { name: "Ana", exact: true }).click();
  await page
    .getByRole("button", { name: "Bookmark guide", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove guide bookmark", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Maps", exact: true }).click();
  await page.getByLabel("Find map").fill("Dorado");
  await page
    .getByRole("button", { name: "Dorado escort", exact: true })
    .click();
  await page.getByRole("button", { name: "Bookmark map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove map bookmark", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Note subject", exact: true })
    .selectOption("strategy:Hold together");
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Wait for everyone before the next fight.");
  await page.getByRole("button", { name: "Dorado · map", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dorado", exact: true }),
  ).toBeVisible();
});

test("a content rollback error releases the save guard and reports the limitation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore previous content", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("desktop");
  await page
    .getByRole("combobox", { name: "Theme", exact: true })
    .selectOption("ember");
  await expect(page.locator(".app")).toHaveClass(/theme-ember/);
  await page.reload();
  await expect(page.locator(".app")).toHaveClass(/theme-ember/);
});
