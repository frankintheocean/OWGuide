import type { Content } from "./schema";
export function bookmarkTarget(content: Content, key: string) {
  const [kind, id] = key.split(":");
  if (kind === "map") {
    const map = content.maps.find((m) => m.id === id);
    return map
      ? { kind: "map" as const, id: map.id, label: `${map.name} · map` }
      : null;
  }
  if (kind === "hero") {
    const hero = content.heroes.find((h) => h.id === id);
    return hero
      ? {
          kind: "hero" as const,
          id: hero.id,
          label: `${hero.name} · guide`,
          strategy: false,
        }
      : null;
  }
  const hero = content.heroes.find((h) => h.id === kind);
  return hero
    ? {
        kind: "hero" as const,
        id: hero.id,
        label: `${hero.name} · ${id ?? "strategy"}`,
        strategy: true,
      }
    : null;
}
