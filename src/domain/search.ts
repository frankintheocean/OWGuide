import type { Content } from "./schema";
export function search(c: Content, q: string) {
  const query = q.trim().toLocaleLowerCase();
  if (!query) return [];
  return [
    ...c.heroes.flatMap((h) => [
      {
        kind: "hero" as const,
        id: h.id,
        title: h.name,
        body: [h.role, h.biography, ...h.playstyle].join(" "),
      },
      ...h.abilities.map((a) => ({
        kind: "hero" as const,
        id: h.id,
        title: `${h.name} · ${a.name}`,
        body: a.description ?? "",
      })),
      ...h.guides.map((g) => ({
        kind: "hero" as const,
        id: h.id,
        title: `${h.name} · ${g.title}`,
        body: g.body,
      })),
    ]),
    ...c.maps.map((m) => ({
      kind: "map" as const,
      id: m.id,
      title: m.name,
      body: [...m.modes, ...m.notes].join(" "),
    })),
  ]
    .filter((r) => `${r.title} ${r.body}`.toLocaleLowerCase().includes(query))
    .slice(0, 80);
}
