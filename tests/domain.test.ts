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
  it("uses official sources for numeric facts and does not invent map coordinates", () => {
    const facts = content.heroes.flatMap((h) =>
      h.abilities.flatMap((a) => a.stats),
    );
    expect(facts).toHaveLength(52);
    expect(
      facts.every((s) =>
        content.sources.some(
          (source) => source.id === s.sourceId && source.kind === "official",
        ),
      ),
    ).toBe(true);
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
          patch: c.patch,
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

it("provides sourced original summaries for every captured ability without inventing numbers", () => {
  for (const hero of content.heroes) {
    for (const ability of hero.abilities) {
      expect(ability.description?.trim().length).toBeGreaterThan(20);
      expect(
        ability.stats.every((s) =>
          content.sources.some(
            (source) => source.id === s.sourceId && source.kind === "official",
          ),
        ),
      ).toBe(true);
    }
  }
});

it("maps standard controller input with a dead zone and ignores unsupported layouts", async () => {
  const { gamepadAction } = await import("../src/domain/gamepad");
  const buttons = Array.from({ length: 16 }, () => ({
    pressed: false,
    touched: false,
    value: 0,
  }));
  expect(
    gamepadAction({ mapping: "standard", axes: [0.2, -0.2], buttons }),
  ).toBeNull();
  expect(gamepadAction({ mapping: "standard", axes: [-0.9, 0], buttons })).toBe(
    "ArrowLeft",
  );
  buttons[0].pressed = true;
  expect(gamepadAction({ mapping: "standard", axes: [0, 0], buttons })).toBe(
    "Enter",
  );
  buttons[1].pressed = true;
  expect(gamepadAction({ mapping: "standard", axes: [0, 0], buttons })).toBe(
    "Escape",
  );
  expect(gamepadAction({ mapping: "", axes: [-1, 0], buttons })).toBeNull();
});

it("keeps current rework facts distinct from archived coaching and six-player values", () => {
  const ability = (heroId: string, id: string) =>
    content.heroes
      .find((h) => h.id === heroId)!
      .abilities.find((a) => a.id === id)!;
  expect(
    ability("roadhog", "chain-hook").stats.find(
      (s) => s.name === "Cooldown (5v5)",
    )?.value,
  ).toBe(6);
  expect(
    ability("sombra", "emp").stats.find(
      (s) => s.name === "Current-health damage",
    )?.value,
  ).toBe(20);
  expect(
    ability("genji", "swift-strike").stats.find((s) => s.name === "Damage")
      ?.value,
  ).toBe(60);
  expect(ability("sombra", "conspirator").kind).toBe("passive");
  expect(
    content.maps
      .filter((m) => m.currentVerified)
      .map((m) => m.id)
      .sort(),
  ).toEqual(["chateau-guillard", "eichenwalde", "hollywood", "lijiang-tower"]);
});

it("uses the same emoji text boundary as the native validator", () => {
  expect(
    userSchema.safeParse({ ...defaultUser, notes: { ana: "🙂".repeat(12000) } })
      .success,
  ).toBe(true);
  expect(
    userSchema.safeParse({ ...defaultUser, notes: { ana: "🙂".repeat(12001) } })
      .success,
  ).toBe(false);
});

it("requires a matching patch and a review date for current recommendations", () => {
  const c = structuredClone(content);
  const matchup = c.matchups.find(
    (row) => row.heroId === "dva" && row.enemyId === "pharah",
  )!;
  matchup.explanation =
    "TEST FIXTURE for review metadata, not a game recommendation";
  matchup.review = {
    ...matchup.review,
    patch: c.patch,
    reviewedAt: c.generatedAt,
    stale: false,
    confidence: "high",
  };
  expect(contentSchema.safeParse(c).success).toBe(true);
  expect(
    recommend(c, ["pharah"], [], "tank", "").find(
      (row) => row.hero.id === "dva",
    )?.score,
  ).toBe(2);
  matchup.review.patch = "TEST OLD PATCH";
  expect(contentSchema.safeParse(c).success).toBe(false);
  expect(
    recommend(c, ["pharah"], [], "tank", "").find(
      (row) => row.hero.id === "dva",
    )?.score,
  ).toBeNull();
  const archived = recommend(c, ["pharah"], [], "tank", "", true).find(
    (row) => row.hero.id === "dva",
  )!;
  expect(archived.score).toBe(2);
  expect(archived.confidence).toBe("low");
  expect(archived.evidence[0].stale).toBe(true);
  matchup.review.patch = c.patch;
  matchup.review.reviewedAt = null;
  expect(contentSchema.safeParse(c).success).toBe(false);
  expect(
    recommend(c, ["pharah"], [], "tank", "").find(
      (row) => row.hero.id === "dva",
    )?.score,
  ).toBeNull();
});
it("does not assign balance review dates to the bundled unreviewed drafts", () => {
  for (const row of [...content.matchups, ...content.synergies]) {
    expect(row.review.stale).toBe(true);
    expect(row.review.reviewedAt).toBeNull();
    expect(row.review.confidence).toBe("low");
  }
});
