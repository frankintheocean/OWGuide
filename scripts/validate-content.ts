import { readFileSync } from "node:fs";
import { contentSchema } from "../src/domain/schema";
const path =
  process.argv.find((a) => a.endsWith(".json")) ?? "src/data/content.json";
const c = contentSchema.parse(JSON.parse(readFileSync(path, "utf8")));
console.log(
  `Schema and references passed: ${c.heroes.length} heroes, ${c.maps.length} maps, ${c.matchups.length} interactions.`,
);
if (process.argv.includes("--release")) {
  const gaps: string[] = [];
  if (!c.rosterVerified || !c.liveVerifiedAt)
    gaps.push("Live roster verification is missing");
  if (/unverified|unknown/i.test(c.patch))
    gaps.push("Live balance patch is missing");
  if (
    c.liveVerifiedAt &&
    Date.now() - Date.parse(c.liveVerifiedAt) > 7 * 86400000
  )
    gaps.push("Live verification is older than seven days");
  for (const h of c.heroes) {
    if (
      !h.biography ||
      !h.difficulty ||
      !h.playstyle.length ||
      !h.strengths.length ||
      !h.weaknesses.length ||
      !Object.keys(h.attributes).length ||
      !h.abilities.length ||
      h.abilities.some((a) => !a.description || a.kind === "unknown") ||
      new Set(h.guides.map((g) => g.level)).size !== 3 ||
      h.review.stale ||
      !h.review.reviewedAt
    )
      gaps.push(`${h.name}: substantive hero review incomplete`);
    if (!c.matchups.some((m) => m.heroId === h.id && !m.review.stale))
      gaps.push(`${h.name}: no current reviewed matchup`);
  }
  if (
    !c.maps.length ||
    c.maps.some((m) => !m.currentVerified || m.review.stale || !m.notes.length)
  )
    gaps.push("Map coverage and coaching review incomplete");
  if (
    c.matchups.some((m) => m.review.stale) ||
    c.synergies.some((m) => m.review.stale) ||
    c.mapFit.some((m) => m.review.stale)
  )
    gaps.push("Stale recommendation relationships remain");
  if (gaps.length) {
    console.error(
      `Release content gate failed (${gaps.length} gaps):\n${gaps.join("\n")}`,
    );
    process.exitCode = 1;
  } else console.log("Production content acceptance passed.");
}
