import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { contentSchema } from "../../src/domain/schema";
const bundledContent = contentSchema.parse(
  JSON.parse(readFileSync("src/data/content.json", "utf8")),
);

test("every captured hero opens all five functional guide tabs", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Full roster sweep runs once; smaller layout has representative coverage.",
  );
  test.setTimeout(180000);
  await page.goto("/");
  for (const hero of bundledContent.heroes) {
    await page.getByRole("button", { name: "Heroes", exact: true }).click();
    await page.getByRole("textbox", { name: "Filter heroes" }).fill(hero.name);
    await page.getByRole("button", { name: hero.name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: hero.name, exact: true }),
    ).toBeVisible();
    for (const tab of [
      "Overview",
      "Abilities",
      "Matchups",
      "Maps",
      "Strategy",
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      const panel = page.getByRole("tabpanel");
      await expect(panel).toBeVisible();
      await expect(panel).not.toBeEmpty();
      if (tab === "Abilities") {
        for (const ability of hero.abilities) {
          await expect(
            panel.getByRole("heading", { name: ability.name, exact: true }),
          ).toHaveCount(1);
        }
      }
      if (tab === "Strategy")
        await expect(
          panel.getByRole("checkbox", { name: "Completed", exact: true }),
        ).toHaveCount(3);
    }
  }
});
