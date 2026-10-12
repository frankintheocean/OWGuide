import type { Hero } from "../domain/schema";
export function HeroGlyph({
  hero,
  large = false,
}: {
  hero: Hero;
  large?: boolean;
}) {
  return (
    <div
      className={`hero-glyph ${hero.role} ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      <div className="glyph-ring" />
      <span>
        {hero.name
          .replace(/[^\p{L}\p{N}]/gu, "")
          .slice(0, 2)
          .toUpperCase()}
      </span>
      <small>{hero.role}</small>
    </div>
  );
}
