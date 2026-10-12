import type { Content, Hero, UserData } from "../domain/schema";
import { Heart, NotebookPen } from "lucide-react";
import { HeroGlyph } from "./HeroGlyph";
import { MapView } from "./MapView";
import { Empty, Missing } from "./Primitives";
export const guideTabs = [
  "Overview",
  "Abilities",
  "Matchups",
  "Maps",
  "Strategy",
] as const;
export type GuideTab = (typeof guideTabs)[number];
interface Props {
  compact?: boolean;
  content: Content;
  user: UserData;
  hero: Hero;
  busy: boolean;
  tab: (typeof guideTabs)[number];
  setTab: (tab: (typeof guideTabs)[number]) => void;
  mapId: string;
  setMapId: (id: string) => void;
  mutate: (fn: (u: UserData) => UserData) => Promise<boolean>;
  favorite: (id: string) => void;
  onNote: (id: string) => void;
  onCompare: (id: string) => void;
}
function Source({ content, hero }: { content: Content; hero: Hero }) {
  const s = content.sources.find((s) => s.id === hero.review.sourceId);
  return (
    <details className="source">
      <summary>
        Source & review ·{" "}
        {hero.review.stale ? "patch review pending" : "reviewed"}
      </summary>
      <p>{s?.label}</p>
      {s && (
        <a href={s.url} target="_blank" rel="noreferrer">
          Open source
        </a>
      )}
      <p>
        Patch: {hero.review.patch}
        <br />
        Confidence: {hero.review.confidence}
        <br />
        Reviewed: {hero.review.reviewedAt ?? "Not live verified"}
      </p>
    </details>
  );
}
export function HeroProfile({
  compact = false,
  content,
  user,
  hero,
  busy,
  tab,
  setTab,
  mapId,
  setMapId,
  mutate,
  favorite,
  onNote,
  onCompare,
}: Props) {
  const tabs = guideTabs;
  const activeMap = content.maps.find((m) => m.id === mapId);
  const mapOptions = content.maps.map((m) => (
    <option key={m.id} value={m.id}>
      {m.name}
    </option>
  ));
  return (
    <>
      <div className="profile-top">
        <HeroGlyph hero={hero} />
        <div>
          <p className={`eyebrow ${hero.role}`}>{hero.role} / field guide</p>
          <h1>{hero.name}</h1>
          <p>{hero.playstyle.join(" · ") || "Playstyle review pending"}</p>
        </div>
        <button
          className="icon-button"
          aria-label={
            user.favorites.includes(hero.id)
              ? "Remove favorite"
              : "Add favorite"
          }
          aria-pressed={user.favorites.includes(hero.id)}
          disabled={busy}
          onClick={() => favorite(hero.id)}
        >
          <Heart
            fill={user.favorites.includes(hero.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="tabs" role="tablist" aria-label="Hero guide sections">
        {tabs.map((t) => (
          <button
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="guide-panel"
            tabIndex={tab === t ? 0 : -1}
            key={t}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const i =
                  (tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : 4)) % 5;
                setTab(tabs[i]);
                document.getElementById(`tab-${tabs[i]}`)?.focus();
              }
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id="guide-panel"
        aria-labelledby={`tab-${tab}`}
        className="guide-panel"
        tabIndex={0}
      >
        {tab === "Overview" && (
          <>
            <div className="card">
              <h2>The essentials</h2>
              <p className="muted">
                This is original qualitative coaching. Difficulty describes
                learning demands, not an official rating or measured statistic.
              </p>
              <p>{hero.biography ?? "Biography awaits source review."}</p>
              <div className="attribute-grid">
                {Object.entries(hero.attributes).map(([k, v]) => (
                  <div key={k}>
                    <small>{k}</small>
                    <strong>{v}</strong>
                  </div>
                ))}
                <div>
                  <small>Difficulty</small>
                  <strong>{hero.difficulty ?? "Not yet reviewed"}</strong>
                </div>
              </div>
            </div>
            <div className="two-col">
              <div className="card">
                <h3>Strengths</h3>
                {hero.strengths.length ? (
                  <ul>
                    {hero.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <Missing />
                )}
              </div>
              <div className="card">
                <h3>Watch out for</h3>
                {hero.weaknesses.length ? (
                  <ul>
                    {hero.weaknesses.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <Missing />
                )}
              </div>
            </div>
          </>
        )}
        {tab === "Abilities" && (
          <div className="ability-grid">
            {hero.abilities.map((a, i) => (
              <article className="card" key={a.id}>
                <span className="ability-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3>{a.name}</h3>
                <small className="badge">
                  {a.kind === "unknown" ? "Type awaiting verification" : a.kind}
                </small>
                <p>
                  {a.description ??
                    "Mechanics and usage tips await review. Use the official hero page for current details."}
                </p>
                {a.stats.length ? (
                  <dl>
                    {a.stats.map((s) => (
                      <div key={s.name}>
                        <dt>{s.name}</dt>
                        <dd>
                          {s.value} {s.unit}{" "}
                          <a
                            href={
                              content.sources.find(
                                (source) => source.id === s.sourceId,
                              )?.url
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source
                          </a>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <small>
                    Cooldown, damage, healing, and range values are not live
                    verified.
                  </small>
                )}
              </article>
            ))}
          </div>
        )}
        {tab === "Matchups" && (
          <>
            <p className="callout">
              Qualitative coaching, not win probabilities. Archived advice needs
              a live patch review.
            </p>
            {content.matchups
              .filter((m) => m.heroId === hero.id)
              .map((m) => (
                <article className="card" key={m.enemyId}>
                  <h3>
                    {content.heroes.find((h) => h.id === m.enemyId)?.name}
                    <span className="badge">
                      {m.value > 0
                        ? "Opportunity"
                        : m.value < 0
                          ? "Threat"
                          : "Neutral"}{" "}
                      · {m.review.confidence}
                    </span>
                  </h3>
                  <p>{m.explanation}</p>
                  <small>
                    {m.review.patch} · {m.review.stale ? "Stale" : "Reviewed"}
                  </small>
                </article>
              ))}
            {!content.matchups.some((m) => m.heroId === hero.id) && (
              <Empty>Reviewed matchups are not available for this hero.</Empty>
            )}
            {content.synergies
              .filter((m) => m.heroId === hero.id || m.allyId === hero.id)
              .map((m, i) => (
                <article className="card" key={i}>
                  <h3>Team interaction</h3>
                  <p>{m.explanation}</p>
                  <small>Patch review pending</small>
                </article>
              ))}
          </>
        )}
        {tab === "Maps" && (
          <>
            <p>
              No hero-specific map ranking has been verified in this package.
            </p>
            <label>
              Explore a map
              <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
                <option value="">Choose a map</option>
                {mapOptions}
              </select>
            </label>
            {activeMap && (
              <MapView
                key={activeMap.id}
                map={activeMap}
                role={hero.role}
                heroId={hero.id}
              />
            )}
          </>
        )}
        {tab === "Strategy" && (
          <>
            {hero.guides.length ? (
              hero.guides.map((g) => {
                const drill = `${hero.id}:${g.level}`;
                return (
                  <article className="card" key={g.level}>
                    <p className="eyebrow">{g.level}</p>
                    <h3>{g.title}</h3>
                    <p>{g.body}</p>
                    <div className="drill">
                      <strong>Practice drill</strong>
                      <p>{g.drill}</p>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={user.completedDrills.includes(drill)}
                          disabled={busy}
                          onChange={() =>
                            void mutate((u) => ({
                              ...u,
                              completedDrills: u.completedDrills.includes(drill)
                                ? u.completedDrills.filter((x) => x !== drill)
                                : [...u.completedDrills, drill],
                            }))
                          }
                        />
                        Completed
                      </label>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void mutate((u) => ({
                          ...u,
                          bookmarks: u.bookmarks.includes(drill)
                            ? u.bookmarks.filter((x) => x !== drill)
                            : [...u.bookmarks, drill],
                        }))
                      }
                    >
                      {user.bookmarks.includes(drill)
                        ? "Remove bookmark"
                        : "Bookmark strategy"}
                    </button>
                  </article>
                );
              })
            ) : (
              <Empty>
                Hero-specific coaching is awaiting review. Your notes and
                bookmarks work offline.
              </Empty>
            )}
          </>
        )}
      </section>
      <div className="toolbar">
        <button
          disabled={busy}
          onClick={() =>
            void mutate((u) => {
              const key = `hero:${hero.id}`;
              return {
                ...u,
                bookmarks: u.bookmarks.includes(key)
                  ? u.bookmarks.filter((x) => x !== key)
                  : [...u.bookmarks, key],
              };
            })
          }
        >
          {user.bookmarks.includes(`hero:${hero.id}`)
            ? "Remove guide bookmark"
            : "Bookmark guide"}
        </button>
        <button onClick={() => onNote(hero.id)}>
          <NotebookPen size={16} />
          Personal notes
        </button>
        {!compact && (
          <button
            onClick={() => {
              onCompare(hero.id);
            }}
          >
            Compare hero
          </button>
        )}
      </div>
      <Source content={content} hero={hero} />
    </>
  );
}
