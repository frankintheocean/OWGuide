import { navigationShortcuts } from "./shortcuts";
import { isCurrentReview } from "./reviews";
import { z } from "zod";
export const roleSchema = z.enum(["tank", "damage", "support"]);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().max(12000);
const source = z
  .object({
    id,
    url: z.url().refine((v) => v.startsWith("https://")),
    label: z.string().min(1),
    retrievedAt: z.iso.datetime(),
    kind: z.enum(["official", "snapshot", "editorial"]),
    license: text,
  })
  .strict();
const review = z
  .object({
    sourceId: id,
    patch: text,
    reviewedAt: z.iso.datetime().nullable(),
    confidence: z.enum(["low", "medium", "high"]),
    stale: z.boolean(),
  })
  .strict();
export type Review = z.infer<typeof review>;
export const guideSchema = z
  .object({
    level: z.enum(["beginner", "intermediate", "advanced"]),
    title: text,
    body: text,
    drill: text,
  })
  .strict();
export const heroSchema = z
  .object({
    id,
    name: z.string().min(1),
    role: roleSchema,
    biography: text.nullable(),
    difficulty: z.enum(["approachable", "moderate", "demanding"]).nullable(),
    playstyle: z.array(text),
    strengths: z.array(text),
    weaknesses: z.array(text),
    attributes: z.record(z.string(), text),
    abilities: z.array(
      z
        .object({
          id,
          name: z.string().min(1),
          description: text.nullable(),
          kind: z.enum(["weapon", "ability", "passive", "ultimate", "unknown"]),
          stats: z.array(
            z
              .object({
                name: text,
                value: z.number().finite().nonnegative(),
                unit: text,
                sourceId: id,
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    perks: z
      .array(
        z
          .object({
            id,
            name: z.string().min(1),
            tier: z.enum(["minor", "major"]),
            description: z.string().min(1).max(12000),
            review,
          })
          .strict(),
      )
      .max(20)
      .optional(),
    guides: z.array(guideSchema),
    review,
  })
  .strict();
export const mapSchema = z
  .object({
    id,
    name: text,
    modes: z.array(text),
    location: text,
    currentVerified: z.boolean(),
    notes: z.array(text),
    markers: z.array(
      z
        .object({
          id,
          label: text,
          kind: z.enum(["cover", "high-ground", "flank", "objective", "choke"]),
          side: z.enum(["attack", "defense", "both"]),
          floor: text,
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          heroIds: z.array(id),
          role: roleSchema.nullable(),
          note: text,
          sourceId: id,
        })
        .strict(),
    ),
    asset: z
      .object({
        path: text,
        sourceId: id,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        license: text,
      })
      .strict()
      .nullable(),
    review,
  })
  .strict();
export const contentStructureSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    patch: text,
    generatedAt: z.iso.datetime(),
    liveVerifiedAt: z.iso.datetime().nullable(),
    rosterVerified: z.boolean(),
    standardTeamSize: z.number().int().min(1).max(12),
    sources: z.array(source),
    heroes: z.array(heroSchema).min(1).max(200),
    maps: z.array(mapSchema).max(300),
    matchups: z.array(
      z
        .object({
          heroId: id,
          enemyId: id,
          value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
          explanation: text,
          review,
        })
        .strict(),
    ),
    synergies: z.array(
      z
        .object({
          heroId: id,
          allyId: id,
          value: z.union([z.literal(-1), z.literal(1)]),
          explanation: text,
          review,
        })
        .strict(),
    ),
    mapFit: z.array(
      z
        .object({
          heroId: id,
          mapId: id,
          value: z.union([z.literal(-1), z.literal(1)]),
          explanation: text,
          review,
        })
        .strict(),
    ),
  })
  .strict();
export const contentSchema = contentStructureSchema.superRefine((c, ctx) => {
  const heroes = new Set(c.heroes.map((h) => h.id)),
    maps = new Set(c.maps.map((m) => m.id)),
    sources = new Set(c.sources.map((s) => s.id));
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (
    heroes.size !== c.heroes.length ||
    maps.size !== c.maps.length ||
    sources.size !== c.sources.length
  )
    issue("Duplicate content ID");
  for (const row of [
    ...c.heroes,
    ...c.maps,
    ...c.heroes.flatMap((h) => h.perks ?? []),
    ...c.matchups,
    ...c.synergies,
    ...c.mapFit,
  ]) {
    if (!row.review.stale && !isCurrentReview(row.review, c.patch))
      issue("Active reviews need a date and the current patch");
  }
  for (const h of c.heroes) {
    if (new Set(h.guides.map((g) => g.level)).size !== h.guides.length)
      issue(`Duplicate guide level in ${h.id}`);
    if (new Set(h.abilities.map((a) => a.id)).size !== h.abilities.length)
      issue(`Duplicate ability in ${h.id}`);
    if (!sources.has(h.review.sourceId)) issue(`Unknown source for ${h.id}`);
    if (
      new Set((h.perks ?? []).map((p) => p.id)).size !== (h.perks ?? []).length
    )
      issue(`Duplicate perk in ${h.id}`);
    for (const p of h.perks ?? [])
      if (!sources.has(p.review.sourceId)) issue("Unknown perk source");
    for (const a of h.abilities) {
      if (new Set(a.stats.map((s) => s.name)).size !== a.stats.length)
        issue(`Duplicate statistic in ${h.id}:${a.id}`);
      for (const s of a.stats)
        if (!sources.has(s.sourceId)) issue("Unknown statistic source");
    }
  }
  for (const m of c.maps) {
    if (new Set(m.markers.map((p) => p.id)).size !== m.markers.length)
      issue(`Duplicate marker in ${m.id}`);
    if (!sources.has(m.review.sourceId)) issue("Unknown map source");
    if (m.markers.length && !m.asset)
      issue("Coordinates require a rights-cleared image");
    if (m.asset && !sources.has(m.asset.sourceId))
      issue("Unknown asset source");
    for (const p of m.markers)
      if (!sources.has(p.sourceId) || p.heroIds.some((h) => !heroes.has(h)))
        issue("Invalid map marker reference");
  }
  for (const e of [...c.matchups, ...c.synergies, ...c.mapFit]) {
    if (!heroes.has(e.heroId) || !sources.has(e.review.sourceId))
      issue("Unknown relationship reference");
    if ("enemyId" in e && (!heroes.has(e.enemyId) || e.enemyId === e.heroId))
      issue("Invalid opponent");
    if ("allyId" in e && (!heroes.has(e.allyId) || e.allyId === e.heroId))
      issue("Invalid ally");
    if ("mapId" in e && !maps.has(e.mapId)) issue("Invalid map");
  }
  for (const rows of [c.matchups, c.synergies, c.mapFit]) {
    const keys = rows.map(
      (e) =>
        `${e.heroId}:${"enemyId" in e ? e.enemyId : "allyId" in e ? e.allyId : e.mapId}`,
    );
    if (new Set(keys).size !== keys.length) issue("Duplicate relationship");
  }
  if (c.rosterVerified && !c.liveVerifiedAt)
    issue("Verified roster needs a live verification timestamp");
});
export type Content = z.infer<typeof contentSchema>;
export type Hero = Content["heroes"][number];
export type GameMap = Content["maps"][number];
export type Role = z.infer<typeof roleSchema>;
export const widgetIds = [
  "favorites",
  "recent",
  "drills",
  "notes",
  "status",
] as const;
export const userSchema = z
  .object({
    schemaVersion: z.literal(1),
    favorites: z.array(id).max(200),
    recent: z.array(id).max(20),
    bookmarks: z.array(z.string().max(200)).max(1000),
    notes: z.record(z.string().max(200), text),
    completedDrills: z.array(z.string().max(200)).max(1000),
    widgets: z.array(z.enum(widgetIds)).max(5),
    settings: z
      .object({
        theme: z.enum(["midnight", "light", "ember"]),
        motion: z.enum(["system", "reduced", "full"]),
        quality: z.enum(["low", "balanced", "high"]),
        sounds: z.boolean(),
        fontScale: z.number().min(0.85).max(1.5),
        contrast: z.boolean(),
        shortcut: z.string().regex(/^[a-z]$/),
        navigationShortcuts: z
          .object({
            home: z.string().regex(/^[a-z]?$/),
            heroes: z.string().regex(/^[a-z]?$/),
            counter: z.string().regex(/^[a-z]?$/),
            maps: z.string().regex(/^[a-z]?$/),
            compare: z.string().regex(/^[a-z]?$/),
            journal: z.string().regex(/^[a-z]?$/),
            settings: z.string().regex(/^[a-z]?$/),
            quick: z.string().regex(/^[a-z]?$/),
          })
          .partial()
          .strict()
          .optional(),
        updateEndpoint: z
          .string()
          .max(2000)
          .refine((v) => !v || /^https:\/\//.test(v)),
        diagnostics: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((u, ctx) => {
    const letters = Object.values(
      navigationShortcuts(u.settings.navigationShortcuts),
    ).filter(Boolean);
    if (new Set(letters).size !== letters.length)
      ctx.addIssue({
        code: "custom",
        message:
          "Navigation shortcut letters must be unique. Disable a binding before reusing its letter.",
      });
    for (const key of [
      "favorites",
      "recent",
      "bookmarks",
      "completedDrills",
      "widgets",
    ] as const) {
      if (new Set(u[key]).size !== u[key].length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${key} entries` });
    }
  });
export type UserData = z.infer<typeof userSchema>;
export const defaultUser: UserData = {
  schemaVersion: 1,
  favorites: [],
  recent: [],
  bookmarks: [],
  notes: {},
  completedDrills: [],
  widgets: [...widgetIds],
  settings: {
    theme: "midnight",
    motion: "system",
    quality: "balanced",
    sounds: false,
    fontScale: 1,
    contrast: false,
    shortcut: "k",
    updateEndpoint: "",
    diagnostics: false,
  },
};
export function parseImport(input: unknown): UserData {
  if (
    input &&
    typeof input === "object" &&
    "schemaVersion" in input &&
    input.schemaVersion === 0
  ) {
    const old = z
      .object({
        schemaVersion: z.literal(0),
        favorites: z.array(id),
        notes: z.record(z.string(), text),
      })
      .strict()
      .parse(input);
    return userSchema.parse({
      ...defaultUser,
      favorites: old.favorites,
      notes: old.notes,
    });
  }
  return userSchema.parse(input);
}
