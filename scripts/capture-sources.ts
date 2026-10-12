import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const directory = "/tmp/owguide-live-heroes";
mkdirSync(directory, { recursive: true });
async function page(url: string) {
  const r = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Source returned ${r.status}: ${url}`);
  return r.text();
}
const roster = await page("https://overwatch.blizzard.com/en-us/heroes/");
const patch = await page(
  "https://overwatch.blizzard.com/en-us/news/patch-notes/live/",
);
writeFileSync("/tmp/owguide-live-heroes.html", roster);
writeFileSync("/tmp/owguide-live-patch.html", patch);
const ids = [
  ...new Set(
    [
      ...roster.matchAll(
        /<a\b[^>]*class="hero-card"[^>]*\bid="([a-z0-9-]+)"[^>]*>/g,
      ),
    ].map((m) => m[1]),
  ),
];
if (!ids.length)
  throw new Error(
    "Official roster markup changed. Stop and review the parser.",
  );
for (let i = 0; i < ids.length; i += 4) {
  await Promise.all(
    ids
      .slice(i, i + 4)
      .map(async (id) =>
        writeFileSync(
          `${directory}/${id}.html`,
          await page(`https://overwatch.blizzard.com/en-us/heroes/${id}/`),
        ),
      ),
  );
  console.log(
    `Captured ${Math.min(i + 4, ids.length)}/${ids.length} hero pages`,
  );
}
writeFileSync(
  "/tmp/owguide-capture.json",
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      rosterSha256: createHash("sha256").update(roster).digest("hex"),
      ids,
    },
    null,
    2,
  ),
);
console.log(
  "Source pages captured outside the checkout. Import metadata, then review editorial content before publishing.",
);
