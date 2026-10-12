import { describe, it, expect } from "vitest";
import { bundledContent as content } from "../src/domain/content";
import {
  contentSchema,
  defaultUser,
  parseImport,
  userSchema,
} from "../src/domain/schema";
import { recommend } from "../src/domain/recommend";
import { search } from "../src/domain/search";
describe("content integrity", () => {
  it("includes the exact captured 54-entry roster and five-tab data structures", () => {
    expect(content.heroes).toHaveLength(54);
    expect(new Set(content.heroes.map((h) => h.id)).size).toBe(54);
    for (const h of content.heroes) {
      expect(h.abilities.length).toBeGreaterThan(0);
      expect(h).toHaveProperty("guides");
      expect(h).toHaveProperty("attributes");
    }
    expect(content.rosterVerified).toBe(true);
  });
  it("rejects duplicate heroes, missing sources and dangling relationships", () => {
    for (const damage of [
      (c: typeof content) => c.heroes.push(c.heroes[0]),
      (c: typeof content) => c.sources.splice(0, 1),
      (c: typeof content) => {
        c.matchups[0].enemyId = "missing";
      },
    ]) {
      const c = structuredClone(content);
      damage(c);
      expect(() => contentSchema.parse(c)).toThrow();
    }
  });
  it("does not invent stats or map coordinates", () => {
    expect(
      content.heroes.flatMap((h) => h.abilities.flatMap((a) => a.stats)),
    ).toEqual([]);
    expect(
      content.maps.every((m) => m.asset === null && m.markers.length === 0),
    ).toBe(true);
  });
  it("rejects marker geometry without an asset", () => {
    const c = structuredClone(content);
    c.maps[0].markers.push({
      id: "test",
      label: "TEST FIXTURE",
      kind: "cover",
      side: "both",
      floor: "one",
      x: 10,
      y: 20,
      heroIds: [],
      role: null,
      note: "Test only",
      sourceId: c.sources[0].id,
    });
    expect(() => contentSchema.parse(c)).toThrow();
  });
});
describe("counter scoring", () => {
  it("excludes stale advice by default and never silently fabricates neutral scores", () => {
    expect(
      recommend(content, ["pharah"], [], "all", "").every(
        (r) => r.score === null,
      ),
    ).toBe(true);
  });
  it("explains deterministic scores and role filtering", () => {
    const rows = recommend(content, ["pharah", "pharah"], [], "tank", "", true);
    expect(rows.every((r) => r.hero.role === "tank")).toBe(true);
    expect(rows.find((r) => r.hero.id === "dva")?.score).toBe(2);
    expect(rows.find((r) => r.hero.id === "reinhardt")?.score).toBe(-2);
    expect(rows.find((r) => r.hero.id === "dva")?.coverage).toBe(1);
    expect(rows[0].evidence.length).toBeGreaterThan(0);
  });
  it("accounts for synergy, unknown threats and excludes already selected allies", () => {
    const rows = recommend(
      content,
      ["roadhog", "pharah"],
      ["genji"],
      "support",
      "",
      true,
    );
    const ana = rows.find((r) => r.hero.id === "ana")!;
    expect(ana.score).toBe(3);
    expect(ana.unknown).toBe(1);
    expect(ana.confidence).toBe("low");
    expect(rows.some((r) => r.hero.id === "genji")).toBe(false);
  });
  it("respects team size and map evidence using a labeled test fixture", () => {
    const c = structuredClone(content);
    c.mapFit = [
      {
        heroId: "dva",
        mapId: c.maps[0].id,
        value: 1,
        explanation: "TEST FIXTURE, not a factual map recommendation",
        review: {
          sourceId: c.sources[0].id,
          patch: "test",
          reviewedAt: c.generatedAt,
          confidence: "high",
          stale: false,
        },
      },
    ];
    expect(recommend(c, [], [], "tank", c.maps[0].id)[0].score).toBe(1);
  });
});
describe("personal data", () => {
  it("imports v1 and migrates v0 without losing notes", () => {
    expect(parseImport(defaultUser)).toEqual(defaultUser);
    expect(
      parseImport({
        schemaVersion: 0,
        favorites: ["ana"],
        notes: { ana: "Remember cover" },
      }).notes.ana,
    ).toBe("Remember cover");
  });
  it("rejects corrupt, oversized and future data without a silent reset", () => {
    expect(() => parseImport({ schemaVersion: 99 })).toThrow();
    expect(() =>
      userSchema.parse({ ...defaultUser, notes: { ana: "x".repeat(12001) } }),
    ).toThrow();
    expect(() => parseImport({ ...defaultUser, unknown: true })).toThrow();
  });
});
describe("universal search", () => {
  it("finds heroes, abilities, maps and original coaching", () => {
    expect(search(content, "Sleep Dart").some((r) => r.id === "ana")).toBe(
      true,
    );
    expect(search(content, "kings row").length).toBe(0);
    expect(
      search(content, "King’s").length + search(content, "King's").length,
    ).toBeGreaterThan(0);
    expect(search(content, "retreat").some((r) => r.kind === "hero")).toBe(
      true,
    );
    expect(search(content, " ").length).toBe(0);
  });
});

it("keeps live metadata complete and distinguishes editorial review from source capture", () => {
  expect(content.heroes.find((h) => h.id === "sombra")?.role).toBe("support");
  expect(
    content.heroes.every(
      (h) => h.biography && new Set(h.guides.map((g) => g.level)).size === 3,
    ),
  ).toBe(true);
  expect(content.liveVerifiedAt).toBeTruthy();
  expect(content.patch).toContain("October 6, 2026");
  expect(content.heroes.every((h) => h.review.stale)).toBe(true);
});

it("keeps teammate synergy in a legal mirrored enemy lineup", () => {
  const rows = recommend(
    content,
    ["genji", "roadhog"],
    ["genji"],
    "support",
    "",
    true,
  );
  expect(rows.find((r) => r.hero.id === "ana")?.score).toBe(3);
});
