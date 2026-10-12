import type { Content } from "./schema";
/** 🧬 Invalidate dependent advice before a curator reviews changed game facts. */
export function invalidateChangedContent(
  previous: Content,
  next: Content,
): Content {
  const result = structuredClone(next);
  const patchChanged = previous.patch !== result.patch;
  const shouldInvalidate = (
    review: Content["heroes"][number]["review"],
    old?: Content["heroes"][number]["review"],
  ) =>
    review.stale ||
    !review.reviewedAt ||
    review.patch !== result.patch ||
    Date.parse(review.reviewedAt) < Date.parse(result.generatedAt) ||
    review.reviewedAt === old?.reviewedAt;

  const changedHeroes = new Set(
    result.heroes
      .filter((hero) => {
        const old = previous.heroes.find((h) => h.id === hero.id);
        return (
          !old ||
          old.role !== hero.role ||
          old.biography !== hero.biography ||
          JSON.stringify(old.abilities) !== JSON.stringify(hero.abilities) ||
          JSON.stringify(old.perks) !== JSON.stringify(hero.perks)
        );
      })
      .map((h) => h.id),
  );
  const mapFacts = ({
    id,
    name,
    modes,
    location,
    currentVerified,
    notes,
    markers,
    asset,
  }: Content["maps"][number]) => ({
    id,
    name,
    modes,
    location,
    currentVerified,
    notes,
    markers,
    asset,
  });
  const changedMaps = new Set(
    result.maps
      .filter((map) => {
        const old = previous.maps.find((m) => m.id === map.id);
        return (
          !old ||
          JSON.stringify(mapFacts(old)) !== JSON.stringify(mapFacts(map))
        );
      })
      .map((m) => m.id),
  );
  for (const hero of result.heroes)
    if (
      (patchChanged || changedHeroes.has(hero.id)) &&
      shouldInvalidate(
        hero.review,
        previous.heroes.find((h) => h.id === hero.id)?.review,
      )
    )
      hero.review.stale = true;
  for (const hero of result.heroes)
    for (const perk of hero.perks ?? []) {
      const old = previous.heroes
        .find((h) => h.id === hero.id)
        ?.perks?.find((p) => p.id === perk.id);
      if (
        (patchChanged ||
          !old ||
          old.description !== perk.description ||
          old.tier !== perk.tier) &&
        shouldInvalidate(perk.review, old?.review)
      )
        perk.review.stale = true;
    }
  for (const map of result.maps)
    if (
      (patchChanged || changedMaps.has(map.id)) &&
      shouldInvalidate(
        map.review,
        previous.maps.find((m) => m.id === map.id)?.review,
      )
    )
      map.review.stale = true;
  for (const matchup of result.matchups)
    if (
      (patchChanged ||
        changedHeroes.has(matchup.heroId) ||
        changedHeroes.has(matchup.enemyId)) &&
      shouldInvalidate(
        matchup.review,
        previous.matchups.find(
          (m) => m.heroId === matchup.heroId && m.enemyId === matchup.enemyId,
        )?.review,
      )
    )
      matchup.review.stale = true;
  for (const synergy of result.synergies)
    if (
      (patchChanged ||
        changedHeroes.has(synergy.heroId) ||
        changedHeroes.has(synergy.allyId)) &&
      shouldInvalidate(
        synergy.review,
        previous.synergies.find(
          (m) => m.heroId === synergy.heroId && m.allyId === synergy.allyId,
        )?.review,
      )
    )
      synergy.review.stale = true;
  for (const fit of result.mapFit)
    if (
      (patchChanged ||
        changedHeroes.has(fit.heroId) ||
        changedMaps.has(fit.mapId)) &&
      shouldInvalidate(
        fit.review,
        previous.mapFit.find(
          (m) => m.heroId === fit.heroId && m.mapId === fit.mapId,
        )?.review,
      )
    )
      fit.review.stale = true;
  return result;
}
