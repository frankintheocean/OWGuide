import type { Content, Role } from "./schema";
export function recommend(
  c: Content,
  enemyIds: string[],
  allyIds: string[],
  role: Role | "all",
  mapId: string,
  includeStale = false,
) {
  const enemies = [...new Set(enemyIds)].slice(0, c.standardTeamSize),
    allies = [...new Set(allyIds)].slice(0, c.standardTeamSize - 1);
  const valid = (r: { stale: boolean }) => includeStale || !r.stale;
  return c.heroes
    .filter(
      (h) => (role === "all" || h.role === role) && !allies.includes(h.id),
    )
    .map((hero) => {
      const evidence: Array<{
        points: number;
        label: string;
        confidence: string;
        stale: boolean;
      }> = [];
      for (const e of c.matchups.filter(
        (e) =>
          e.heroId === hero.id &&
          enemies.includes(e.enemyId) &&
          valid(e.review),
      ))
        evidence.push({
          points: e.value * 2,
          label: e.explanation,
          confidence: e.review.confidence,
          stale: e.review.stale,
        });
      for (const e of c.synergies.filter(
        (e) =>
          e.heroId === hero.id && allies.includes(e.allyId) && valid(e.review),
      ))
        evidence.push({
          points: e.value,
          label: e.explanation,
          confidence: e.review.confidence,
          stale: e.review.stale,
        });
      for (const e of c.mapFit.filter(
        (e) => e.heroId === hero.id && e.mapId === mapId && valid(e.review),
      ))
        evidence.push({
          points: e.value,
          label: e.explanation,
          confidence: e.review.confidence,
          stale: e.review.stale,
        });
      const coverage = c.matchups.filter(
        (e) =>
          e.heroId === hero.id &&
          enemies.includes(e.enemyId) &&
          valid(e.review),
      ).length;
      return {
        hero,
        score: evidence.length
          ? evidence.reduce((n, e) => n + e.points, 0)
          : null,
        evidence,
        coverage,
        unknown: enemies.length - coverage,
        confidence: evidence.length
          ? evidence.some((e) => e.confidence === "low" || e.stale)
            ? "low"
            : evidence.some((e) => e.confidence === "medium")
              ? "medium"
              : "high"
          : "unknown",
      };
    })
    .sort(
      (a, b) =>
        (a.score === null ? 1 : 0) - (b.score === null ? 1 : 0) ||
        (b.score ?? 0) - (a.score ?? 0) ||
        b.coverage - a.coverage ||
        a.hero.name.localeCompare(b.hero.name),
    );
}
