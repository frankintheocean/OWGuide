import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { acceptanceProblems } from "./acceptance-report.mjs";
const paths = [
  "src",
  "src-tauri",
  "scripts",
  "tests",
  "docs/WINDOWS-TESTS.md",
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
const problems = acceptanceProblems(report, tree);
if (problems.length)
  throw new Error(`Production acceptance failed:\n${problems.join("\n")}`);
console.log(
  "Recorded production acceptance and evidence match this source tree.",
);
