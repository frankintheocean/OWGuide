import { it, expect } from "vitest";
import { bundledContent } from "../src/domain/content";
import { invalidateChangedContent } from "../src/domain/content-review";
function reviewedFixture() {
  const c = structuredClone(bundledContent);
  for (const row of [...c.heroes, ...c.maps, ...c.matchups, ...c.synergies]) {
    row.review.stale = false;
    row.review.patch = c.patch;
    row.review.reviewedAt = c.generatedAt;
  }
  c.mapFit = [
    {
      heroId: "ana",
      mapId: c.maps[0].id,
      value: 1,
      explanation: "TEST FIXTURE, not a factual ranking",
      review: { ...c.heroes.find((h) => h.id === "ana")!.review },
    },
  ];
  return c;
}
it("role changes invalidate the hero and all dependent advice without mutating either package", () => {
  const old = reviewedFixture(),
    next = structuredClone(old);
  next.heroes.find((h) => h.id === "ana")!.role = "damage";
  const result = invalidateChangedContent(old, next);
  expect(result.heroes.find((h) => h.id === "ana")!.review.stale).toBe(true);
  expect(
    result.matchups
      .filter((m) => m.heroId === "ana" || m.enemyId === "ana")
      .every((m) => m.review.stale),
  ).toBe(true);
  expect(result.synergies[0].review.stale).toBe(true);
  expect(result.mapFit[0].review.stale).toBe(true);
  expect(result.heroes.find((h) => h.id === "ashe")!.review.stale).toBe(false);
  expect(next.heroes.find((h) => h.id === "ana")!.review.stale).toBe(false);
  expect(old.heroes.find((h) => h.id === "ana")!.role).toBe("support");
});
it("map changes invalidate map coaching and map fit but review metadata alone does not", () => {
  const old = reviewedFixture(),
    next = structuredClone(old);
  next.maps[0].notes.push("TEST FIXTURE");
  const result = invalidateChangedContent(old, next);
  expect(result.maps[0].review.stale).toBe(true);
  expect(result.mapFit[0].review.stale).toBe(true);
  expect(result.heroes.every((h) => !h.review.stale)).toBe(true);
  const metadata = structuredClone(old);
  metadata.maps[0].review.confidence = "low";
  expect(invalidateChangedContent(old, metadata).mapFit[0].review.stale).toBe(
    false,
  );
});
it("patch changes invalidate existing reviews, and a later explicit review is preserved", () => {
  const old = reviewedFixture(),
    next = structuredClone(old);
  next.patch = "TEST PATCH";
  const result = invalidateChangedContent(old, next);
  expect(
    [
      ...result.heroes,
      ...result.maps,
      ...result.matchups,
      ...result.synergies,
      ...result.mapFit,
    ].every((row) => row.review.stale),
  ).toBe(true);
  const ana = next.heroes.find((h) => h.id === "ana")!;
  ana.review = {
    ...ana.review,
    patch: next.patch,
    reviewedAt: new Date(Date.parse(next.generatedAt) + 1000).toISOString(),
  };
  expect(
    invalidateChangedContent(old, next).heroes.find((h) => h.id === "ana")!
      .review.stale,
  ).toBe(false);
});
it("perk changes invalidate related advice and patch changes mark unrevised perks stale", () => {
  const old = reviewedFixture(),
    next = structuredClone(old);
  next.heroes[0].perks![0].description += " Changed mechanic.";
  const changed = invalidateChangedContent(old, next);
  expect(changed.heroes[0].review.stale).toBe(true);
  expect(changed.heroes[0].perks![0].review.stale).toBe(true);
  expect(changed.heroes[0].perks![1].review.stale).toBe(false);
  const patch = structuredClone(old);
  patch.patch = "Next patch";
  expect(
    invalidateChangedContent(old, patch).heroes.every((h) =>
      h.perks?.every((p) => p.review.stale),
    ),
  ).toBe(true);
});
