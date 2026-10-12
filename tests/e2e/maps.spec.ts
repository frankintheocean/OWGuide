import { test, expect } from "@playwright/test";
test("map component pans, zooms, selects and filters synthetic test markers", async ({
  page,
}) => {
  await page.goto("/tests/map-harness.html");
  await expect(
    page.getByRole("heading", { name: "Synthetic test grid" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("status")).toHaveText("125%");
  await page
    .locator(".map-canvas")
    .getByRole("button", { name: "Test cover", exact: true })
    .click();
  await expect(page.locator("article.selected")).toContainText(
    "Synthetic cover marker test",
  );
  await page
    .getByRole("combobox", { name: "Side", exact: true })
    .selectOption("defense");
  await expect(page.locator(".map-marker")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Floor", exact: true })
    .selectOption("ground");
  await expect(page.locator(".map-marker")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Floor", exact: true })
    .selectOption("all");
  const canvas = page.locator(".map-canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 170, box.y + 160);
  await page.mouse.up();
  await expect(page.locator(".map-layer")).not.toHaveAttribute(
    "style",
    /translate\(0px, 0px\)/,
  );
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(page.getByRole("status")).toHaveText("100%");
});
