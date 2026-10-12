import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("main navigation, selector and settings pass automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Your field guide." }).waitFor();
  for (const screen of ["Dashboard", "Heroes", "Settings"]) {
    await page.getByRole("button", { name: screen, exact: true }).click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      ),
    ).toEqual([]);
  }
});
