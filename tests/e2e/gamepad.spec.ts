import { test, expect } from "@playwright/test";
test("a standard controller can browse, open and leave the selector", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await page.locator(".hero-tile").first().focus();
  await page.evaluate(() => {
    const pad = {
      mapping: "standard",
      connected: true,
      axes: [0.9, 0],
      buttons: Array.from({ length: 16 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
    window.dispatchEvent(new Event("gamepadconnected"));
  });
  await expect(page.locator(".hero-tile").nth(1)).toBeFocused();
  await page.evaluate(() => {
    const pad = navigator.getGamepads()[0] as unknown as {
      axes: number[];
      buttons: { pressed: boolean }[];
    };
    Object.defineProperty(pad, "axes", { value: [0, 0] });
    pad.buttons[0].pressed = true;
  });
  await expect(page.getByRole("tablist")).toBeVisible();
  await page.evaluate(() => {
    const pad = navigator.getGamepads()[0] as unknown as {
      axes: number[];
      buttons: { pressed: boolean }[];
    };
    pad.buttons[0].pressed = false;
    pad.buttons[1].pressed = true;
  });
  await expect(page.locator(".hero-grid")).toBeVisible();
});
