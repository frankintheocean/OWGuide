import { useState } from "react";
import type { Hero } from "../domain/schema";
export function HeroGlyph({
  hero,
  large = false,
}: {
  hero: Hero;
  large?: boolean;
}) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const portrait = hero.portrait;
  return (
    <div
      className={`hero-glyph ${hero.role} ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      {portrait && portrait.path !== failedPath ? (
        <img
          className="hero-headshot"
          src={portrait.path}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedPath(portrait.path)}
        />
      ) : null}
      <div className="glyph-ring" />
      <span
        style={
          portrait && portrait.path !== failedPath
            ? { visibility: "hidden" }
            : undefined
        }
      >
        {hero.name
          .replace(/[^\p{L}\p{N}]/gu, "")
          .slice(0, 2)
          .toUpperCase()}
      </span>
      <small>
        {portrait && failedPath === portrait.path
          ? "Image unavailable"
          : hero.role}
      </small>
    </div>
  );
}
