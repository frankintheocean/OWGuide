/** 🥊 Import narrow editorial matchup reviews with captured-mechanic references. */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { contentSchema } from "../src/domain/schema";
const content = contentSchema.parse(
  JSON.parse(readFileSync("src/data/content.json", "utf8")),
);
const reportSchema = z
  .object({
    patch: z.string(),
    reviewedAt: z.iso.datetime(),
    reviewer: z.string(),
    method: z.string(),
    limitations: z.array(z.string()),
    matchups: z.array(
      z
        .object({
          heroId: z.string(),
          enemyId: z.string(),
          value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
          heroAbilityId: z.string(),
          enemyAbilityId: z.string(),
          explanation: z.string().min(100),
          confidence: z.literal("low"),
          heroSourceUrl: z.url(),
          enemySourceUrl: z.url(),
          heroPageSha256: z.string().regex(/^[a-f0-9]{64}$/),
          enemyPageSha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    ),
  })
  .strict();
const reportBytes = readFileSync("content/matchup-reviews.json");
const report = reportSchema.parse(JSON.parse(reportBytes.toString("utf8")));
if (
  report.patch !== content.patch ||
  Date.parse(report.reviewedAt) > Date.now()
)
  throw Error("Review patch or date is invalid");
const revision = process.argv[2];
if (!revision || !/^[a-f0-9]{40}$/.test(revision))
  throw Error("Pass the exact commit containing the reviewed file");
const committed = execFileSync("git", [
  "show",
  `${revision}:content/matchup-reviews.json`,
]);
if (!committed.equals(reportBytes))
  throw Error("Review file differs from its pinned source commit");
const evidence = JSON.parse(
  readFileSync("content/ability-evidence.json", "utf8"),
) as { heroPages: { heroId: string; rawSha256: string; url: string }[] };
for (const row of report.matchups) {
  for (const [heroId, abilityId, url, hash] of [
    [row.heroId, row.heroAbilityId, row.heroSourceUrl, row.heroPageSha256],
    [row.enemyId, row.enemyAbilityId, row.enemySourceUrl, row.enemyPageSha256],
  ]) {
    const hero = content.heroes.find((h) => h.id === heroId),
      page = evidence.heroPages.find((p) => p.heroId === heroId);
    if (
      !hero?.abilities.some((a) => a.id === abilityId) ||
      !page ||
      page.url !== url ||
      page.rawSha256 !== hash
    )
      throw Error(`Mechanic reference changed: ${heroId}:${abilityId}`);
  }
}
const sourceId = "owguide-current-matchup-editorial";
content.sources = content.sources.filter((s) => s.id !== sourceId);
content.sources.push({
  id: sourceId,
  url: `https://github.com/frankintheocean/OWGuide/blob/${revision}/content/matchup-reviews.json`,
  label: "Current source-based editorial matchup review (not play-tested)",
  retrievedAt: report.reviewedAt,
  kind: "editorial",
  license:
    "Original OWGuide coaching, GPL-3.0; game mechanics attributed to official pages.",
});
content.matchups = report.matchups.map((row) => ({
  heroId: row.heroId,
  enemyId: row.enemyId,
  value: row.value,
  explanation: row.explanation,
  review: {
    sourceId,
    patch: report.patch,
    reviewedAt: report.reviewedAt,
    confidence: row.confidence,
    stale: false,
  },
}));
if (
  content.version.split(".").map(Number)[0] === 0 &&
  Number(content.version.split(".")[1]) < 8
)
  content.version = "0.8.0";
content.generatedAt = new Date().toISOString();
writeFileSync(
  "src/data/content.json",
  JSON.stringify(contentSchema.parse(content), null, 2) + "\n",
);
console.log(
  `Imported ${content.matchups.length} scoped current editorial matchups; unlisted pairs remain unknown.`,
);
