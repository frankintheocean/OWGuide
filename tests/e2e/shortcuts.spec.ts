import { test, expect } from "@playwright/test";
test("navigation bindings persist, reject conflicts and can be disabled", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const binding = page.getByRole("combobox", {
    name: "Heroes shortcut",
    exact: true,
  });
  await binding.selectOption("x");
  await expect(binding).toHaveValue("x");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(binding).toHaveValue("x");
  await page.keyboard.press("Control+Alt+x");
  await expect(page.getByLabel("Filter heroes")).toBeVisible();
  await page.keyboard.press("Control+Alt+n");
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+Alt+s");
  await binding.selectOption("m");
  await expect(page.getByRole("status")).toContainText("unique");
  await expect(binding).toHaveValue("x");
  await binding.selectOption("");
  await expect(binding).toHaveValue("");
  await page.keyboard.press("Control+Alt+x");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  const popup = page.waitForEvent("popup");
  await page.keyboard.press("Control+Alt+q");
  const quick = await popup;
  await expect(
    quick.getByRole("combobox", { name: "Hero", exact: true }),
  ).toBeVisible();
});
