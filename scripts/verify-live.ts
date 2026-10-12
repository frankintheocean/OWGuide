import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { bundledContent } from "../src/domain/content";
// 🔍 Evidence capture only. Human review must approve factual and editorial changes.
const urls = [
  "https://overwatch.blizzard.com/en-us/heroes/",
  "https://overwatch.blizzard.com/en-us/news/patch-notes/live/",
];
const records: Array<{
  url: string;
  retrievedAt: string;
  sha256: string;
  roster: string[];
  patchTitle: string | null;
}> = [];
for (const url of urls) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Source returned ${response.status}: ${url}`);
  const html = await response.text();
  const hash = createHash("sha256").update(html).digest("hex");
  const roster = [
    ...html.matchAll(
      /<a\b[^>]*class="hero-card"[^>]*\bid="([a-z0-9-]+)"[^>]*>/g,
    ),
  ].map((m) => m[1]);
  records.push({
    url,
    retrievedAt: new Date().toISOString(),
    sha256: hash,
    roster: [...new Set(roster)],
    patchTitle:
      [...html.matchAll(/<h[1-5][^>]*>(.*?)<\/h[1-5]>/gs)]
        .map((m) =>
          m[1]
            .replace(/<[^>]*>/g, "")
            .replace(/&ndash;/g, "–")
            .replace(/&amp;/g, "&")
            .trim(),
        )
        .find((t) => t.includes("Overwatch Retail Patch Notes")) ?? null,
  });
}
if (!records[0].roster.length)
  throw new Error(
    "Official roster markup changed; do not mark content verified.",
  );
const missing = records[0].roster.filter(
    (id) => !bundledContent.heroes.some((h) => h.id === id),
  ),
  extra = bundledContent.heroes
    .filter((h) => !records[0].roster.includes(h.id))
    .map((h) => h.id);
writeFileSync(
  "content/live-evidence.json",
  JSON.stringify(
    {
      records,
      missing,
      extra,
      note: "Patch identity, modes, prose and guides still require human review.",
    },
    null,
    2,
  ) + "\n",
);
if (!records[1].patchTitle || records[1].patchTitle !== bundledContent.patch)
  throw new Error(
    `Official patch title changed or could not be parsed. Review the content before release.`,
  );
if (missing.length || extra.length)
  throw new Error(
    `Roster differs: missing ${missing.join(", ")}; extra ${extra.join(", ")}`,
  );
console.log(
  "Roster IDs and patch title match the official pages. Coaching, numeric mechanics, map rotation and Windows acceptance remain separate checks.",
);
