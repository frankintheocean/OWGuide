import { test, expect } from "@playwright/test";
test("official perks open in the guide and are searchable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await page.getByLabel("Filter heroes").fill("Anran");
  await page.getByRole("button", { name: "Anran", exact: true }).click();
  await page.getByRole("tab", { name: "Abilities", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Smoulder", exact: true }),
  ).toBeVisible();
  const perk = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Smoulder", exact: true }),
  });
  await expect(perk).toContainText("1.5 seconds longer");
  await expect(
    perk.getByRole("link", { name: "Official hero page" }),
  ).toHaveAttribute(
    "href",
    "https://overwatch.blizzard.com/en-us/heroes/anran/",
  );
  await page.getByLabel("Search all guides").fill("Smoulder");
  await expect(
    page.getByRole("button", { name: /Anran · Smoulder/ }),
  ).toBeVisible();
});
