import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const required = [
  "liveRosterAndPatch",
  "allHeroGuides",
  "allSupportedMaps",
  "windows10",
  "windows11",
  "webViewOffline",
  "mainAndQuickWindows",
  "multiMonitorAndDpi",
  "keyboardAndScreenReader",
  "installerGuiAndDeleteData",
  "portableReadonlyFailure",
  "securityReview",
];
const paths = [
  "src",
  "src-tauri",
  "packaging",
  "package.json",
  "package-lock.json",
  "rust-toolchain.toml",
  "content/content.schema.json",
  "content/user.schema.json",
  ".github/workflows",
];
const objects = paths
  .map((path) =>
    execFileSync("git", ["rev-parse", `HEAD:${path}`], {
      encoding: "utf8",
    }).trim(),
  )
  .join("\n");
const tree = createHash("sha256").update(objects).digest("hex");
if (process.argv.includes("--print-tree")) {
  console.log(tree);
  process.exit(0);
}
const report = JSON.parse(
  readFileSync("content/production-acceptance.json", "utf8"),
);
const checked = Date.parse(report.checkedAt);
if (
  report.sourceTree !== tree ||
  !report.reviewer ||
  !Number.isFinite(checked) ||
  checked > Date.now() + 300000 ||
  Date.now() - checked > 7 * 86400000 ||
  required.some((k) => report.checks?.[k] !== true)
)
  throw new Error(
    "Production acceptance is missing, incomplete, stale, or belongs to a different source tree. Run and record the Windows checks first.",
  );
console.log("Recorded production acceptance matches this source tree.");
