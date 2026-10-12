import { test, expect } from "@playwright/test";
import { defaultUser } from "../../src/domain/schema";
test("a large personal notebook stays small in the DOM and supports keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const user = structuredClone(defaultUser);
  user.notes = Object.fromEntries(
    Array.from({ length: 1000 }, (_, i) => [
      `strategy:Plan ${String(i).padStart(4, "0")}`,
      `Personal note ${i}`,
    ]),
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "personal-notes.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(user)),
  });
  await expect(page.getByRole("status")).toContainText("Import saved");
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  const list = page.getByRole("region", { name: "Saved notes list" });
  expect(await list.getByRole("button").count()).toBeLessThanOrEqual(15);
  await list.getByRole("button", { name: "Plan 0000", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(
    list.getByRole("button", { name: "Plan 0999", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Personal note 999");
  await list.getByRole("button", { name: "Plan 0999", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(
    list.getByRole("button", { name: "Plan 0000", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Personal note 1");
});
