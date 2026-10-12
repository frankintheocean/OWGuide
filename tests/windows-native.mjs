// 🖥️ Exercise real Tauri/WebView2 windows; never substitute browser storage.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { release } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
if (process.platform !== "win32")
  throw new Error("Native checks require Windows and WebView2.");
const executable = resolve(
  process.argv[2] ?? "release/OWGuide-1.0.0-portable/OWGuide.exe",
);
if (!existsSync(join(dirname(executable), "portable.marker")))
  throw new Error("Native checks require the isolated portable candidate.");
const directory = resolve("test-results/native-windows");
mkdirSync(directory, { recursive: true });
const checks = [];
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
let processHandle, browser;
function windowAction(title, action, width = 1000, height = 720) {
  execFileSync(
    "pwsh",
    [
      "-NoProfile",
      "-File",
      "tests/windows-window.ps1",
      "-Title",
      title,
      "-Action",
      action,
      "-Width",
      String(width),
      "-Height",
      String(height),
    ],
    { stdio: "pipe" },
  );
}
async function start() {
  processHandle = spawn(executable, [], {
    cwd: dirname(executable),
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
        '--remote-debugging-port=9222 --host-resolver-rules="MAP * ~NOTFOUND"',
    },
    stdio: "ignore",
  });
  processHandle.on("error", (error) => {
    writeFileSync(join(directory, "launch-error.txt"), String(error));
  });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9222", {
        timeout: 2000,
      });
      break;
    } catch {
      await delay(500);
    }
  }
  if (!browser)
    throw new Error("Could not connect to the actual WebView2 target.");
  const context = browser.contexts()[0];
  await expect
    .poll(() => context.pages().length, { timeout: 15000 })
    .toBeGreaterThan(0);
  const page =
    context.pages().find((p) => !p.url().includes("quick=1")) ??
    context.pages()[0];
  await page.getByRole("button", { name: "Heroes", exact: true }).waitFor();
  const native = await page.evaluate(() =>
    Boolean(globalThis.__TAURI_INTERNALS__),
  );
  expect(native).toBe(true);
  return { context, page };
}
async function stop() {
  if (browser) {
    await browser.close();
    browser = undefined;
  }
  if (processHandle && processHandle.exitCode === null) {
    windowAction("OWGuide", "close");
    try {
      await expect
        .poll(() => processHandle.exitCode, { timeout: 15000 })
        .not.toBeNull();
    } catch {
      processHandle.kill();
      throw new Error("Native app did not exit after closing its main window.");
    }
  }
}
try {
  let { context, page } = await start();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Heroes", exact: true }).click();
  await page.getByRole("textbox", { name: "Filter heroes" }).fill("Ana");
  await page.getByRole("button", { name: "Ana", exact: true }).click();
  for (const tab of ["Overview", "Abilities", "Matchups", "Maps", "Strategy"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
  }
  checks.push("native offline reload and five guide tabs");
  await page.getByRole("button", { name: "Add favorite", exact: true }).click();
  await page
    .getByRole("button", { name: "Personal notes", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your note", exact: true })
    .fill("Native SQLite acceptance note.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Note saved");
  await page
    .getByRole("button", { name: "Quick Reference", exact: true })
    .click();
  await expect.poll(() => context.pages().length, { timeout: 15000 }).toBe(2);
  const quick = context.pages().find((p) => p !== page);
  await quick
    .getByRole("combobox", { name: "Hero", exact: true })
    .selectOption("ana");
  await quick
    .getByRole("button", { name: "Personal notes", exact: true })
    .click();
  await expect(
    quick.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Native SQLite acceptance note.");
  await quick
    .getByRole("textbox", { name: "Your note", exact: true })
    .fill("Quick window SQLite acceptance note.");
  await quick.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(quick.getByRole("alert")).toContainText("Note saved");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Note subject", exact: true })
    .selectOption("ana");
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Quick window SQLite acceptance note.");
  checks.push("SQLite notes/favorites and native cross-window synchronization");
  for (const action of ["maximize", "restore", "resize"]) {
    windowAction("OWGuide", action, 900, 680);
    await expect(
      page.getByRole("textbox", { name: "Your note", exact: true }),
    ).toBeVisible();
  }
  windowAction("OWGuide · Quick Reference", "resize", 340, 450);
  await expect
    .poll(() => quick.evaluate(() => globalThis.innerWidth), { timeout: 10000 })
    .toBeLessThan(400);
  await expect(
    quick.getByRole("textbox", { name: "Your note", exact: true }),
  ).toBeVisible();
  for (const p of [page, quick]) {
    await expect
      .poll(
        () =>
          p.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
        { timeout: 10000 },
      )
      .toBe(true);
    const accessibility = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  }
  await page.screenshot({ path: join(directory, "main.png") });
  await quick.screenshot({ path: join(directory, "quick.png") });
  checks.push("native maximize/restore/resize and automated accessibility");
  windowAction("OWGuide · Quick Reference", "close");
  await expect.poll(() => context.pages().length).toBe(1);
  await stop();
  const statePath = join(dirname(executable), "OWGuideData", "windows.json");
  expect(existsSync(statePath)).toBe(true);
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  expect(state.main).toBeDefined();
  expect(state.quick).toBeDefined();
  ({ context, page } = await start());
  await context.setOffline(true);
  await page.getByRole("button", { name: "Notebook", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Note subject", exact: true })
    .selectOption("ana");
  await expect(
    page.getByRole("textbox", { name: "Your note", exact: true }),
  ).toHaveValue("Quick window SQLite acceptance note.");
  await page
    .getByRole("button", { name: "Quick Reference", exact: true })
    .click();
  await expect.poll(() => context.pages().length).toBe(2);
  const restoredQuick = context.pages().find((p) => p !== page);
  await expect
    .poll(() => restoredQuick.evaluate(() => globalThis.innerWidth), {
      timeout: 10000,
    })
    .toBeLessThan(400);
  checks.push(
    "desktop restart preserves notes and independent compact window dimensions",
  );
  writeFileSync(
    join(directory, "validation.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        head,
        checkedAt: new Date().toISOString(),
        platform: process.platform,
        release: release(),
        checks,
        limitations: [
          "Not Windows 10/11 physical hardware coverage",
          "Not manual screen-reader or multi-monitor validation",
          "No installer GUI automation",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  writeFileSync(join(directory, "failure.txt"), String(error?.stack ?? error));
  throw error;
} finally {
  await stop();
}
console.log(checks.join("\n"));
