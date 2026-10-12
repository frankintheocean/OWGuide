import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("exposes only required frontend event permissions and keeps remote content out of the webview", () => {
  const capability = JSON.parse(
    readFileSync("src-tauri/capabilities/main.json", "utf8"),
  );
  expect(capability.permissions.sort()).toEqual([
    "core:event:allow-listen",
    "core:event:allow-unlisten",
  ]);
  expect(capability.windows.sort()).toEqual(["main", "quick"]);
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  const csp = config.app.security.csp as string;
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).toContain("frame-src 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("connect-src ipc: http://ipc.localhost");
  expect(csp).not.toMatch(/https:|\*/);
});
