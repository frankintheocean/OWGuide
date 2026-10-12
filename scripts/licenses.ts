import { readFileSync, writeFileSync } from "node:fs";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
  packages: Record<string, { version?: string; license?: string }>;
};
const licenses = Object.entries(lock.packages)
  .filter(([path]) => path.startsWith("node_modules/"))
  .map(([path, pkg]) => ({
    name: path.split("node_modules/").at(-1),
    version: pkg.version,
    license: pkg.license ?? "REVIEW REQUIRED",
    path,
  }));
writeFileSync(
  "dependency-licenses.json",
  JSON.stringify(
    {
      note: "Includes build and runtime packages. Review license texts before distribution.",
      packages: licenses,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Reported ${licenses.length} locked packages.`);
