import { test, expect } from "@playwright/test";
test("text size enlarges navigation and headings and persists in the compact window", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const navigation = page.getByRole("button", { name: "Heroes", exact: true });
  const heading = page.getByRole("heading", { name: "Settings", exact: true });
  const before = await navigation.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  const headingBefore = await heading.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  await page
    .getByRole("combobox", { name: "Text size", exact: true })
    .selectOption("1.5");
  await expect
    .poll(() =>
      navigation.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    )
    .toBeGreaterThan(before * 1.4);
  await expect
    .poll(() =>
      heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    )
    .toBeGreaterThan(headingBefore);
  const compact = await context.newPage();
  await compact.goto("/?quick=1");
  await compact.setViewportSize({ width: 340, height: 450 });
  await compact.getByLabel("Hero", { exact: true }).selectOption("ana");
  await compact.getByRole("tab", { name: "Strategy", exact: true }).click();
  await compact.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(
    compact.getByRole("tab", { name: "Abilities", exact: true }),
  ).toBeInViewport();
  await compact.getByRole("tab", { name: "Abilities", exact: true }).click();
  await expect(compact.getByRole("tabpanel")).toContainText("Sleep Dart");
  await expect
    .poll(() =>
      compact.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
    .toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Text size", exact: true }),
  ).toHaveValue("1.5");
});
