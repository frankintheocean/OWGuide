import { test, expect } from "@playwright/test";
for (const compact of [false, true]) {
  test(`hero header stays available during ${compact ? "compact" : "main"} guide scrolling`, async ({
    page,
  }) => {
    await page.goto(compact ? "/?quick=1" : "/");
    if (compact) {
      await page.setViewportSize({ width: 340, height: 450 });
      await page.getByLabel("Hero", { exact: true }).selectOption("ana");
    } else {
      await page.getByRole("button", { name: "Heroes", exact: true }).click();
      await page.getByLabel("Filter heroes").fill("Ana");
      await page.getByRole("button", { name: "Ana", exact: true }).click();
    }
    await page.getByRole("tab", { name: "Strategy", exact: true }).click();
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const header = page.locator(".guide-header");
    await expect
      .poll(async () => (await header.boundingBox())?.y)
      .toBeGreaterThanOrEqual(0);
    await expect(
      page.getByRole("heading", { name: "Ana", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("tab", { name: "Abilities", exact: true }),
    ).toBeInViewport();
    await page.getByRole("tab", { name: "Abilities", exact: true }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Sleep Dart");
  });
}
