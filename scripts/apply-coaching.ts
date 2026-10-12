import { readFileSync, writeFileSync } from "node:fs";
import { contentSchema } from "../src/domain/schema";
const c = contentSchema.parse(
  JSON.parse(readFileSync("src/data/content.json", "utf8")),
);
const coaching = JSON.parse(
  readFileSync("content/coaching.json", "utf8"),
) as Record<string, string[]>;
for (const h of c.heroes) {
  const entry = coaching[h.id];
  if (!entry) continue;
  const [bio, style, beginner, intermediate, advanced] = entry;
  h.biography = bio;
  h.playstyle = [style];
  h.guides = [
    {
      level: "beginner",
      title: "Build a useful position",
      body: beginner,
      drill:
        "Review one match. Pause before three engagements and identify your cover, useful target, and retreat route.",
    },
    {
      level: "intermediate",
      title: "Choose the right resource",
      body: intermediate,
      drill:
        "Record three uses of the named ability. Explain the threat it answered and the option you lost by spending it.",
    },
    {
      level: "advanced",
      title: "Coordinate the commitment",
      body: advanced,
      drill:
        "Before three fights, tell a teammate what opening you want and which defensive answer would stop it. Review whether you waited for that answer.",
    },
  ];
  // Advice is original source-informed coaching, not a measured rating or completed balance review.
  h.review.sourceId = "owguide-editorial";
  h.review.reviewedAt = null;
  h.review.stale = true;
  h.review.patch = c.patch;
}
writeFileSync(
  "src/data/content.json",
  JSON.stringify(contentSchema.parse(c), null, 2) + "\n",
);
console.log(
  `Added original source-informed coaching for ${Object.keys(coaching).length} heroes; all tactical reviews remain pending.`,
);
