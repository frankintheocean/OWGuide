import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  BookOpen,
  ChevronRight,
  Columns3,
  Compass,
  Download,
  Heart,
  Home,
  Keyboard,
  Map as MapIcon,
  NotebookPen,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  PanelsTopLeft,
  X,
} from "lucide-react";
import {
  defaultUser,
  parseImport,
  widgetIds,
  type Role,
  type UserData,
} from "./domain/schema";
import {
  load,
  save,
  download,
  quickReference,
  openSource,
  updateContent,
  rollbackContent,
  type Snapshot,
} from "./domain/storage";
import { recommend } from "./domain/recommend";
import { search } from "./domain/search";
import { bookmarkTarget } from "./domain/bookmarks";
import { record, diagnosticEvents } from "./domain/diagnostics";
import { useGamepad } from "./hooks/useGamepad";
import { HeroGlyph } from "./components/HeroGlyph";
import { MapView } from "./components/MapView";
import { Empty, Missing, RoleFilter } from "./components/Primitives";
import { HeroProfile, type GuideTab } from "./components/HeroProfile";
import { Endpoint, TeamSelect } from "./components/Controls";
type Page =
  "home" | "heroes" | "counter" | "maps" | "compare" | "journal" | "settings";
const nav = [
  ["home", "Dashboard", Home],
  ["heroes", "Heroes", Compass],
  ["counter", "Counter Picker", Target],
  ["maps", "Maps", MapIcon],
  ["compare", "Compare", Columns3],
  ["journal", "Notebook", NotebookPen],
  ["settings", "Settings", Settings],
] as const;
const quick = new URLSearchParams(location.search).get("quick") === "1";
function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [fatal, setFatal] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const current = useRef<Snapshot | null>(null),
    pending = useRef(false);
  const [page, setPage] = useState<Page>("home"),
    [selected, setSelected] = useState("ana"),
    [profile, setProfile] = useState(false),
    [tab, setTab] = useState<GuideTab>("Overview");
  const [role, setRole] = useState<Role | "all">("all"),
    [query, setQuery] = useState(""),
    [globalQuery, setGlobalQuery] = useState(""),
    [sort, setSort] = useState("name");
  const [enemy, setEnemy] = useState<string[]>([]),
    [allies, setAllies] = useState<string[]>([]),
    [counterRole, setCounterRole] = useState<Role | "all">("all"),
    [mapId, setMapId] = useState(""),
    [stale, setStale] = useState(false),
    [compare, setCompare] = useState<string[]>([]);
  const [mapQuery, setMapQuery] = useState(""),
    [mode, setMode] = useState("all"),
    [mapHero, setMapHero] = useState("");
  const [noteKey, setNoteKey] = useState("personal"),
    [draft, setDraft] = useState(""),
    [strategyTitle, setStrategyTitle] = useState(""),
    [dragged, setDragged] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null),
    gridRef = useRef<HTMLDivElement>(null);
  const controller = useGamepad(gridRef, page === "heroes" && !quick);
  const refresh = useCallback(async (retry = false) => {
    try {
      const s = await load(retry);
      if (!current.current)
        setSelected(s.user.recent[0] ?? s.user.favorites[0] ?? "ana");
      current.current = s;
      setSnapshot(s);
      record("data-loaded");
      setFatal("");
    } catch (e) {
      record("load-failed");
      setFatal(message(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isTauri())
      void listen("data-changed", () => {
        if (!pending.current) void refresh();
      }).then((f) => {
        if (disposed) f();
        else unlisten = f;
      });
    const onStorage = () => {
      if (!pending.current) void refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);
  useEffect(() => {
    if (!isTauri()) return;
    const click = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (anchor?.href.startsWith("https://")) {
        event.preventDefault();
        void openSource(anchor.href).catch((e) => setNotice(message(e)));
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  const mutate = useCallback(
    async (fn: (u: UserData) => UserData) => {
      if (pending.current) {
        setNotice("Finish the current save before making another change.");
        return false;
      }
      const s = current.current;
      if (!s) return false;
      pending.current = true;
      setBusy(true);
      try {
        const next = parseImport(fn(structuredClone(s.user)));
        const revision = await save(next, s.revision);
        const updated = { ...s, user: next, revision };
        current.current = updated;
        setSnapshot(updated);
        record("data-saved");
        return true;
      } catch (e) {
        record("data-save-failed");
        setNotice(message(e));
        await refresh();
        return false;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  useEffect(() => {
    const error = () => record("render-error"),
      rejection = () => record("unhandled-rejection");
    window.addEventListener("error", error);
    window.addEventListener("unhandledrejection", rejection);
    return () => {
      window.removeEventListener("error", error);
      window.removeEventListener("unhandledrejection", rejection);
    };
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === (snapshot?.user.settings.shortcut ?? "k")
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setGlobalQuery("");
        setProfile(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [snapshot?.user.settings.shortcut]);
  const content = snapshot?.content,
    user = snapshot?.user ?? defaultUser;
  const hero =
    content?.heroes.find((h) => h.id === selected) ?? content?.heroes[0];
  const filtered = useMemo(
    () =>
      content?.heroes
        .filter(
          (h) =>
            (role === "all" || h.role === role) &&
            `${h.name} ${h.playstyle.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "role"
            ? a.role.localeCompare(b.role) || a.name.localeCompare(b.name)
            : sort === "favorites"
              ? Number(user.favorites.includes(b.id)) -
                  Number(user.favorites.includes(a.id)) ||
                a.name.localeCompare(b.name)
              : a.name.localeCompare(b.name),
        ) ?? [],
    [content, role, query, sort, user.favorites],
  );
  const results = useMemo(
    () => (content ? search(content, globalQuery) : []),
    [content, globalQuery],
  );
  const recommendations = useMemo(
    () =>
      content
        ? recommend(content, enemy, allies, counterRole, mapId, stale)
        : [],
    [content, enemy, allies, counterRole, mapId, stale],
  );
  function pick(id: string, open = false) {
    setSelected(id);
    setTab("Overview");
    setProfile(open);
    if (open)
      void mutate((u) => ({
        ...u,
        recent: [id, ...u.recent.filter((x) => x !== id)].slice(0, 20),
      }));
    if (user.settings.sounds) {
      const context = new AudioContext();
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.07);
      osc.frequency.value = 440;
      osc.start();
      osc.stop(context.currentTime + 0.07);
      osc.onended = () => void context.close();
    }
  }
  function favorite(id: string) {
    void mutate((u) => ({
      ...u,
      favorites: u.favorites.includes(id)
        ? u.favorites.filter((x) => x !== id)
        : [...u.favorites, id],
    }));
  }
  function openHero(id: string) {
    setPage("heroes");
    pick(id, true);
    setGlobalQuery("");
  }
  function openNote(key: string) {
    setNoteKey(key);
    setDraft(user.notes[key] ?? "");
    setPage("journal");
  }
  async function importFile(file: File) {
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Import is limited to 2 MiB.");
      const imported = parseImport(JSON.parse(await file.text()));
      const ok = await mutate(() => imported);
      if (ok)
        setNotice(
          "Import saved. Your existing personal data was replaced by the selected backup.",
        );
    } catch (e) {
      setNotice(`Import failed: ${message(e)}`);
    }
  }
  function editDraft(value: string) {
    if (Array.from(value).length > 12000) {
      setNotice(
        "Your note can contain up to 12000 characters. The previous draft was kept.",
      );
      return;
    }
    setDraft(value);
  }
  function reorder(id: string, target: string) {
    void mutate((u) => {
      const widgets = u.widgets.filter((x) => x !== id);
      widgets.splice(
        widgets.indexOf(target as (typeof widgetIds)[number]),
        0,
        id as (typeof widgetIds)[number],
      );
      return { ...u, widgets };
    });
    setDragged(null);
  }
  if (fatal)
    return (
      <main className="fatal">
        <h1>Cannot load your data</h1>
        <p role="alert">{fatal}</p>
        <p>
          Your stored data has not been deleted. Back it up before making
          repairs.
        </p>
        <button onClick={() => void refresh(true)}>Retry</button>
      </main>
    );
  if (!snapshot || !content || !hero)
    return (
      <main className="fatal" aria-busy="true">
        <h1>Opening your field guide…</h1>
      </main>
    );
  const activeMap = content.maps.find((m) => m.id === mapId);
  const css = { "--font-scale": user.settings.fontScale } as CSSProperties;
  const settings = user.settings;
  const heroOptions = content.heroes.map((h) => (
    <option key={h.id} value={h.id}>
      {h.name} · {h.role}
    </option>
  ));
  const mapOptions = content.maps.map((m) => (
    <option key={m.id} value={m.id}>
      {m.name}
    </option>
  ));
  const updateSettings = (patch: Partial<UserData["settings"]>) =>
    void mutate((u) => ({ ...u, settings: { ...u.settings, ...patch } }));
  const profileBody = (
    <HeroProfile
      compact={quick}
      content={content}
      user={user}
      hero={hero}
      busy={busy}
      tab={tab}
      setTab={setTab}
      mapId={mapId}
      setMapId={setMapId}
      mutate={mutate}
      favorite={favorite}
      onNote={openNote}
      onCompare={(id) => {
        setCompare((c) => (c.includes(id) ? c : [...c.slice(-2), id]));
        setPage("compare");
      }}
    />
  );
  if (quick)
    return (
      <div
        className={`app quick theme-${settings.theme} motion-${settings.motion} quality-${settings.quality} ${settings.contrast ? "contrast" : ""}`}
        style={css}
      >
        <header>
          <img src="/icon.svg" alt="" width="32" />
          <strong>Quick Reference</strong>
          <label className="sr-only" htmlFor="quick-hero">
            Hero
          </label>
          <select
            id="quick-hero"
            value={hero.id}
            onChange={(e) => pick(e.target.value)}
          >
            {heroOptions}
          </select>
        </header>
        {notice && (
          <p className="callout" role="alert">
            {notice}
          </p>
        )}
        <main>
          {page === "journal" ? (
            <>
              <button onClick={() => setPage("home")}>← Quick Reference</button>
              <h2>Personal notes · {hero.name}</h2>
              <label>
                Your note
                <textarea
                  aria-label="Your note"
                  maxLength={24000}
                  rows={12}
                  value={draft}
                  onChange={(e) => editDraft(e.target.value)}
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate((u) => ({
                    ...u,
                    notes: { ...u.notes, [noteKey]: draft },
                  })).then((ok) => {
                    if (ok) setNotice("Note saved.");
                  })
                }
              >
                Save note
              </button>
            </>
          ) : (
            profileBody
          )}
        </main>
      </div>
    );
  return (
    <div
      className={`app theme-${settings.theme} motion-${settings.motion} quality-${settings.quality} ${settings.contrast ? "contrast" : ""}`}
      style={css}
    >
      <a href="#main" className="skip">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          aria-label="OWGuide dashboard"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
          }}
        >
          <img src="/icon.svg" alt="" />
          <span>
            OWGuide<small>YOUR FIELD GUIDE</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              title={label}
              aria-current={page === id ? "page" : undefined}
              onClick={() => {
                setPage(id);
                setProfile(false);
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="offline-dot" /> Offline first
          <small>App 1.0.0 · Content {content.version}</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="search-wrap">
            <Search size={18} />
            <input
              ref={searchRef}
              aria-label="Search all guides"
              placeholder="Search heroes, abilities, maps…"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
            />
            <kbd>Ctrl {settings.shortcut.toUpperCase()}</kbd>
            {globalQuery && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setGlobalQuery("")}
              >
                <X size={16} />
              </button>
            )}
            {globalQuery && (
              <div className="search-results" aria-label="Search results">
                {results.length ? (
                  results.map((r, i) => (
                    <button
                      key={`${r.id}-${i}`}
                      onClick={() => {
                        if (r.kind === "hero") openHero(r.id);
                        else {
                          setMapId(r.id);
                          setPage("maps");
                          setGlobalQuery("");
                        }
                      }}
                    >
                      <span>{r.title}</span>
                      <small>{r.kind}</small>
                    </button>
                  ))
                ) : (
                  <Empty>No results.</Empty>
                )}
              </div>
            )}
          </div>
          <button
            aria-label="Quick Reference"
            onClick={() =>
              void quickReference().catch((e) => setNotice(message(e)))
            }
          >
            <PanelsTopLeft size={17} />
            <span>Quick Reference</span>
          </button>
        </header>
        {!content.rosterVerified && (
          <div className="data-banner">
            <Shield size={15} />
            <span>
              Snapshot content · Live roster and patch unverified. Missing data
              is labeled.
            </span>
            <button onClick={() => setPage("settings")}>Details</button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={17} />
            </button>
          </div>
        )}
        <main id="main" className="main-content">
          {page === "home" && (
            <>
              <div className="page-title">
                <p className="eyebrow">A BETTER NEXT FIGHT</p>
                <h1>Your field guide.</h1>
                <p>Build a plan. Learn a hero. Keep your progress.</p>
              </div>
              <div className="hero-banner">
                <div>
                  <span className="badge">Continue learning</span>
                  <h2>{hero.name}</h2>
                  <p>{hero.playstyle.join(" · ") || "Open a hero guide"}</p>
                  <button className="primary" onClick={() => openHero(hero.id)}>
                    Open field guide <ChevronRight size={17} />
                  </button>
                </div>
                <HeroGlyph hero={hero} large />
              </div>
              <details className="widget-settings">
                <summary>
                  <SlidersHorizontal size={16} />
                  Customize dashboard
                </summary>
                {widgetIds.map((w) => (
                  <label key={w} className="check">
                    <input
                      type="checkbox"
                      checked={user.widgets.includes(w)}
                      disabled={busy}
                      onChange={() =>
                        void mutate((u) => ({
                          ...u,
                          widgets: u.widgets.includes(w)
                            ? u.widgets.filter((x) => x !== w)
                            : [...u.widgets, w],
                        }))
                      }
                    />
                    {w}
                  </label>
                ))}
              </details>
              <div className="dashboard-grid">
                {user.widgets.map((w, i) => (
                  <section
                    className="card widget"
                    key={w}
                    draggable
                    onDragStart={() => setDragged(w)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragged && dragged !== w) reorder(dragged, w);
                    }}
                  >
                    <div className="section-heading">
                      <h3>
                        {w === "favorites"
                          ? "Favorite heroes"
                          : w === "recent"
                            ? "Recently opened"
                            : w === "drills"
                              ? "Learning progress"
                              : w === "notes"
                                ? "Your notebook"
                                : "Content status"}
                      </h3>
                      <div>
                        <button
                          className="reorder"
                          aria-label={`Move ${w} left`}
                          disabled={i === 0 || busy}
                          onClick={() => reorder(w, user.widgets[i - 1])}
                        >
                          ←
                        </button>
                        <button
                          className="reorder"
                          aria-label={`Move ${w} right`}
                          disabled={i === user.widgets.length - 1 || busy}
                          onClick={() => {
                            const target = user.widgets[i + 1];
                            void mutate((u) => {
                              const widgets = [...u.widgets];
                              [widgets[i], widgets[i + 1]] = [target, w];
                              return { ...u, widgets };
                            });
                          }}
                        >
                          →
                        </button>
                      </div>
                    </div>
                    {(w === "favorites" || w === "recent") && (
                      <>
                        {user[w].length ? (
                          user[w].map((id) => {
                            const h = content.heroes.find((h) => h.id === id);
                            return h ? (
                              <button
                                className="list-row"
                                key={id}
                                onClick={() => openHero(id)}
                              >
                                <span>{h.name}</span>
                                <small>{h.role}</small>
                                <ChevronRight size={16} />
                              </button>
                            ) : null;
                          })
                        ) : (
                          <Empty>
                            {w === "favorites"
                              ? "Tap a heart on a hero to keep it here."
                              : "Open a guide to start your history."}
                          </Empty>
                        )}
                      </>
                    )}
                    {w === "drills" && (
                      <>
                        <strong className="metric">
                          {user.completedDrills.length}
                        </strong>
                        <p>Completed practice drills</p>
                        <button
                          onClick={() => {
                            openHero("ana");
                            setTab("Strategy");
                          }}
                        >
                          Explore practice drills
                        </button>
                      </>
                    )}
                    {w === "notes" && (
                      <>
                        <p>
                          {Object.values(user.notes).filter(Boolean).length}{" "}
                          saved notes · {user.bookmarks.length} bookmarks
                        </p>
                        <button onClick={() => openNote("personal")}>
                          Open notebook
                        </button>
                      </>
                    )}
                    {w === "status" && (
                      <>
                        <p>
                          {content.heroes.length} hero entries ·{" "}
                          {content.maps.length} map entries
                        </p>
                        <small>{content.patch}</small>
                        <button onClick={() => setPage("settings")}>
                          Review sources & updates
                        </button>
                      </>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {page === "heroes" && (
            <>
              {profile ? (
                <>
                  <button className="back" onClick={() => setProfile(false)}>
                    ← Hero selector
                  </button>
                  {profileBody}
                </>
              ) : (
                <>
                  <div className="page-title">
                    <p className="eyebrow">CHOOSE YOUR APPROACH</p>
                    <h1>Find your hero.</h1>
                  </div>
                  <div className="selector">
                    <section className="hero-library">
                      <label className="hero-search">
                        <Search size={16} />
                        <input
                          aria-label="Filter heroes"
                          placeholder="Find a hero…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <RoleFilter value={role} onChange={setRole} />
                      <label className="sort-label">
                        Sort
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="name">Name</option>
                          <option value="role">Role</option>
                          <option value="favorites">Favorites first</option>
                        </select>
                      </label>
                      <div
                        className="hero-grid"
                        ref={gridRef}
                        aria-label="Hero selector"
                        onKeyDown={(e) => {
                          const buttons = Array.from(
                              gridRef.current?.querySelectorAll<HTMLButtonElement>(
                                ".hero-tile",
                              ) ?? [],
                            ),
                            index = buttons.indexOf(
                              document.activeElement as HTMLButtonElement,
                            );
                          let offset = 0;
                          if (e.key === "ArrowRight") offset = 1;
                          if (e.key === "ArrowLeft") offset = -1;
                          const columns = gridRef.current
                            ? getComputedStyle(
                                gridRef.current,
                              ).gridTemplateColumns.split(" ").length
                            : 3;
                          if (e.key === "ArrowDown") offset = columns;
                          if (e.key === "ArrowUp") offset = -columns;
                          if (offset && index >= 0) {
                            e.preventDefault();
                            const next =
                              buttons[
                                (index + offset + buttons.length) %
                                  buttons.length
                              ];
                            next?.focus();
                            if (next?.dataset.hero) pick(next.dataset.hero);
                          }
                        }}
                      >
                        {filtered.map((h) => (
                          <button
                            key={h.id}
                            className={`hero-tile ${selected === h.id ? "selected" : ""}`}
                            data-hero={h.id}
                            aria-pressed={selected === h.id}
                            onFocus={() => setSelected(h.id)}
                            onClick={() => pick(h.id, true)}
                          >
                            <HeroGlyph hero={h} />
                            <span>{h.name}</span>
                            {user.favorites.includes(h.id) && (
                              <Heart className="tile-heart" size={12} />
                            )}
                          </button>
                        ))}
                      </div>
                      {!filtered.length && <Empty>No matching heroes.</Empty>}
                      <small className="keyboard-hint">
                        <Keyboard size={14} />
                        {controller
                          ? "Controller: D-pad / stick to browse · A to open · B to return"
                          : "Arrow keys to browse · Enter to open"}
                      </small>
                    </section>
                    <section
                      className={`hero-stage ${hero.role}`}
                      key={hero.id}
                    >
                      <div className="stage-grid" />
                      <p className="stage-label">
                        {hero.role.toUpperCase()} /{" "}
                        {String(content.heroes.indexOf(hero) + 1).padStart(
                          2,
                          "0",
                        )}
                      </p>
                      <HeroGlyph hero={hero} large />
                      <div className="stage-name">
                        <h2>{hero.name}</h2>
                        <p>
                          Original identity artwork · hero illustration
                          unavailable
                        </p>
                      </div>
                    </section>
                    <section className="hero-info">
                      <p className={`eyebrow ${hero.role}`}>{hero.role}</p>
                      <h2>{hero.name}</h2>
                      <span className="badge">
                        {hero.difficulty ?? "Difficulty unreviewed"}
                      </span>
                      <p>
                        {hero.biography ??
                          "Official metadata is available for this hero. Biography and coaching await review."}
                      </p>
                      <h3>Playstyle</h3>
                      <p>{hero.playstyle.join(" · ") || "Not yet reviewed"}</p>
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
                      <h3>Weaknesses</h3>
                      {hero.weaknesses.length ? (
                        <ul>
                          {hero.weaknesses.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      ) : (
                        <Missing />
                      )}
                      <button
                        className="primary"
                        onClick={() => pick(hero.id, true)}
                      >
                        Open full guide
                        <ChevronRight size={18} />
                      </button>
                      <button disabled={busy} onClick={() => favorite(hero.id)}>
                        <Heart size={16} />
                        {user.favorites.includes(hero.id)
                          ? "Remove favorite"
                          : "Favorite hero"}
                      </button>
                    </section>
                  </div>
                </>
              )}
            </>
          )}
          {page === "counter" && (
            <>
              <div className="page-title">
                <p className="eyebrow">READ THE FIGHT</p>
                <h1>Counter Picker</h1>
                <p>Explainable editorial scores. No win-rate claims.</p>
              </div>
              <div className="card">
                <TeamSelect
                  title={`Enemy team (${enemy.length}/${content.standardTeamSize})`}
                  selected={enemy}
                  options={content.heroes}
                  max={content.standardTeamSize}
                  onChange={setEnemy}
                />
                <TeamSelect
                  title="Your teammates"
                  selected={allies}
                  options={content.heroes}
                  max={content.standardTeamSize - 1}
                  onChange={setAllies}
                />
                <RoleFilter value={counterRole} onChange={setCounterRole} />
                <label>
                  Map
                  <select
                    value={mapId}
                    onChange={(e) => setMapId(e.target.value)}
                  >
                    <option value="">No map context</option>
                    {mapOptions}
                  </select>
                </label>
                {mapId && !content.mapFit.some((m) => m.mapId === mapId) && (
                  <p className="callout">
                    No reviewed map-fit evidence is available for{" "}
                    {activeMap?.name}. The score does not include map points for
                    this selection.
                  </p>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={stale}
                    onChange={(e) => setStale(e.target.checked)}
                  />
                  Include archived advice awaiting patch review
                </label>
                <p className="muted">
                  Matchups: ±2 points · Team interactions: ±1 · Map fit: ±1.
                  Missing evidence contributes no points. Coverage matters;
                  scores are not probabilities.
                </p>
              </div>
              {stale && (
                <p className="callout">
                  Archived advice can be wrong for the live patch. All bundled
                  matchup advice is currently stale.
                </p>
              )}
              {enemy.length === 0 ? (
                <Empty>
                  Select an opponent to compare one hero, or add the whole enemy
                  team.
                </Empty>
              ) : (
                <>
                  <div className="counter-results">
                    {recommendations
                      .filter((r) => r.score !== null)
                      .map((r, i) => (
                        <article
                          className="card recommendation"
                          key={r.hero.id}
                        >
                          <span className="rank">{i + 1}</span>
                          <div>
                            <button
                              className="text-button"
                              onClick={() => openHero(r.hero.id)}
                            >
                              <h3>{r.hero.name}</h3>
                            </button>
                            <p>
                              {r.hero.role} · {r.confidence} confidence ·{" "}
                              {r.coverage}/{enemy.length} threats reviewed
                            </p>
                            {r.evidence.map((e, i) => (
                              <p key={i}>
                                <span className="score-inline">
                                  {e.points > 0 ? "+" : ""}
                                  {e.points}
                                </span>
                                {e.label}
                              </p>
                            ))}
                            {r.unknown > 0 && (
                              <small>
                                {r.unknown} opponents have no reviewed
                                interaction.
                              </small>
                            )}
                          </div>
                          <strong className="score">
                            {r.score! > 0 ? "+" : ""}
                            {r.score}
                          </strong>
                        </article>
                      ))}
                  </div>
                  {recommendations.every((r) => r.score === null) && (
                    <Empty>
                      No reviewed evidence supports a ranking for this
                      selection. Change the role or select archived advice
                      explicitly.
                    </Empty>
                  )}
                  <details>
                    <summary>
                      Heroes with insufficient evidence (
                      {recommendations.filter((r) => r.score === null).length})
                    </summary>
                    {recommendations
                      .filter((r) => r.score === null)
                      .map((r) => (
                        <button
                          key={r.hero.id}
                          className="list-row"
                          onClick={() => openHero(r.hero.id)}
                        >
                          {r.hero.name}
                          <small>Unranked · no evidence</small>
                        </button>
                      ))}
                  </details>
                </>
              )}
            </>
          )}
          {page === "maps" && (
            <>
              <div className="page-title">
                <p className="eyebrow">KNOW THE GROUND</p>
                <h1>Map library</h1>
                <p>
                  Source mode listings. Current rotation and tactical
                  annotations await verification.
                </p>
              </div>
              <div className="toolbar">
                <label>
                  Find map
                  <input
                    value={mapQuery}
                    onChange={(e) => setMapQuery(e.target.value)}
                    placeholder="Map name"
                  />
                </label>
                <label>
                  Mode
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="all">All modes</option>
                    {[...new Set(content.maps.flatMap((m) => m.modes))]
                      .sort()
                      .map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Hero context
                  <select
                    value={mapHero}
                    onChange={(e) => setMapHero(e.target.value)}
                  >
                    <option value="">Any hero</option>
                    {heroOptions}
                  </select>
                </label>
              </div>
              <div className="map-layout">
                <div className="map-list">
                  {content.maps
                    .filter(
                      (m) =>
                        m.name.toLowerCase().includes(mapQuery.toLowerCase()) &&
                        (mode === "all" || m.modes.includes(mode)),
                    )
                    .map((m) => (
                      <button
                        className={`list-row ${mapId === m.id ? "selected" : ""}`}
                        key={m.id}
                        onClick={() => setMapId(m.id)}
                      >
                        <span>{m.name}</span>
                        <small>{m.modes.join(" / ")}</small>
                      </button>
                    ))}
                </div>
                {activeMap ? (
                  <MapView
                    key={activeMap.id}
                    map={activeMap}
                    role={
                      content.heroes.find((h) => h.id === mapHero)?.role ??
                      "all"
                    }
                    heroId={mapHero}
                    bookmarked={user.bookmarks.includes(`map:${activeMap.id}`)}
                    bookmarkDisabled={busy}
                    onBookmark={() =>
                      void mutate((u) => {
                        const key = `map:${activeMap.id}`;
                        return {
                          ...u,
                          bookmarks: u.bookmarks.includes(key)
                            ? u.bookmarks.filter((x) => x !== key)
                            : [...u.bookmarks, key],
                        };
                      })
                    }
                  />
                ) : (
                  <Empty>Select a map to open its field guide.</Empty>
                )}
              </div>
            </>
          )}
          {page === "compare" && (
            <>
              <div className="page-title">
                <p className="eyebrow">PICK YOUR FIT</p>
                <h1>Hero comparison</h1>
                <p>
                  Compare up to three heroes. Unverified numeric statistics stay
                  blank.
                </p>
              </div>
              <TeamSelect
                title="Compare heroes"
                selected={compare}
                options={content.heroes}
                max={3}
                onChange={setCompare}
              />
              {compare.length ? (
                <div className="comparison">
                  {compare.map((id) => {
                    const h = content.heroes.find((h) => h.id === id);
                    return h ? (
                      <article className="card" key={id}>
                        <HeroGlyph hero={h} />
                        <button
                          className="text-button"
                          onClick={() => openHero(h.id)}
                        >
                          <h2>{h.name}</h2>
                        </button>
                        <p>
                          {h.role} · {h.difficulty ?? "Difficulty unreviewed"}
                        </p>
                        <h3>Approach</h3>
                        <p>{h.playstyle.join(" / ") || "Not yet reviewed"}</p>
                        {Object.entries(h.attributes).map(([k, v]) => (
                          <p key={k}>
                            <strong>{k}</strong>
                            <br />
                            {v}
                          </p>
                        ))}
                        <h3>Abilities</h3>
                        {h.abilities.map((a) => (
                          <p key={a.id}>{a.name}</p>
                        ))}
                        <small>Patch review pending</small>
                      </article>
                    ) : null;
                  })}
                </div>
              ) : (
                <Empty>
                  Select heroes to compare their roles, abilities, and reviewed
                  attributes.
                </Empty>
              )}
            </>
          )}
          {page === "journal" && (
            <>
              <div className="page-title">
                <p className="eyebrow">MAKE IT YOURS</p>
                <h1>Your notebook</h1>
                <p>Notes stay separate from content updates.</p>
              </div>
              <div className="two-col">
                <section className="card">
                  <div className="toolbar">
                    <label>
                      New strategy title
                      <input
                        maxLength={80}
                        value={strategyTitle}
                        onChange={(e) => setStrategyTitle(e.target.value)}
                        placeholder="My team’s plan"
                      />
                    </label>
                    <button
                      disabled={busy || !strategyTitle.trim()}
                      onClick={() => {
                        const key = `strategy:${strategyTitle.trim()}`;
                        if (key in user.notes) {
                          setNoteKey(key);
                          setDraft(user.notes[key]);
                          setNotice("Opened your existing strategy.");
                          return;
                        }
                        void mutate((u) => ({
                          ...u,
                          notes: { ...u.notes, [key]: "" },
                        })).then((ok) => {
                          if (ok) {
                            setNoteKey(key);
                            setDraft("");
                            setStrategyTitle("");
                          }
                        });
                      }}
                    >
                      Create strategy
                    </button>
                  </div>
                  <label>
                    Note subject
                    <select
                      value={noteKey}
                      onChange={(e) => {
                        setNoteKey(e.target.value);
                        setDraft(user.notes[e.target.value] ?? "");
                      }}
                    >
                      <option value="personal">Personal strategy</option>
                      {heroOptions}
                      {Object.keys(user.notes)
                        .filter(
                          (k) =>
                            k !== "personal" &&
                            !content.heroes.some((h) => h.id === k),
                        )
                        .map((k) => (
                          <option key={k} value={k}>
                            {k.replace(/^strategy:/, "")}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Your note
                    <textarea
                      aria-label="Your note"
                      maxLength={24000}
                      rows={12}
                      value={draft}
                      onChange={(e) => editDraft(e.target.value)}
                      placeholder="A plan, a lesson, a reminder…"
                    />
                  </label>
                  <div className="toolbar">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void mutate((u) => ({
                          ...u,
                          notes: { ...u.notes, [noteKey]: draft },
                        })).then((ok) => {
                          if (ok) setNotice("Note saved.");
                        })
                      }
                    >
                      Save note
                    </button>
                    <button
                      disabled={busy || !Object.hasOwn(user.notes, noteKey)}
                      onClick={() =>
                        void mutate((u) => {
                          delete u.notes[noteKey];
                          return u;
                        }).then((ok) => {
                          if (ok) {
                            setDraft("");
                            if (noteKey.startsWith("strategy:"))
                              setNoteKey("personal");
                          }
                        })
                      }
                    >
                      Delete saved note
                    </button>
                  </div>
                  <small>
                    {Array.from(draft).length}/12000 characters · Save before
                    changing subject
                  </small>
                </section>
                <section className="card">
                  <h3>Saved notes</h3>
                  {Object.entries(user.notes)
                    .filter(([, v]) => v)
                    .map(([k]) => (
                      <button
                        className="list-row"
                        key={k}
                        onClick={() => {
                          setNoteKey(k);
                          setDraft(user.notes[k]);
                        }}
                      >
                        {content.heroes.find((h) => h.id === k)?.name ??
                          k.replace(/^strategy:/, "")}
                      </button>
                    ))}
                  <h3>Bookmarked strategies</h3>
                  {user.bookmarks.length ? (
                    user.bookmarks.map((k) => {
                      const target = bookmarkTarget(content, k);
                      return (
                        <div className="bookmark-row" key={k}>
                          <button
                            className="list-row"
                            onClick={() => {
                              if (!target) {
                                setNotice(
                                  "This bookmark is not in the current content package.",
                                );
                                return;
                              }
                              if (target.kind === "map") {
                                setMapId(target.id);
                                setPage("maps");
                              } else {
                                openHero(target.id);
                                if (target.strategy) setTab("Strategy");
                              }
                            }}
                          >
                            {target?.label ?? `${k} · unavailable`}
                          </button>
                          <button
                            aria-label={`Remove bookmark ${target?.label ?? k}`}
                            disabled={busy}
                            onClick={() =>
                              void mutate((u) => ({
                                ...u,
                                bookmarks: u.bookmarks.filter((x) => x !== k),
                              }))
                            }
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <Empty>Bookmark a drill in a hero’s Strategy tab.</Empty>
                  )}
                </section>
              </div>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-title">
                <p className="eyebrow">YOUR GUIDE, YOUR WAY</p>
                <h1>Settings</h1>
              </div>
              <div className="settings-grid">
                <section className="card">
                  <h2>
                    <Sparkles size={20} />
                    Appearance & access
                  </h2>
                  <label>
                    Theme
                    <select
                      value={settings.theme}
                      onChange={(e) =>
                        updateSettings({
                          theme: e.target.value as typeof settings.theme,
                        })
                      }
                    >
                      <option value="midnight">Midnight</option>
                      <option value="light">Daylight</option>
                      <option value="ember">Ember</option>
                    </select>
                  </label>
                  <label>
                    Motion
                    <select
                      value={settings.motion}
                      onChange={(e) =>
                        updateSettings({
                          motion: e.target.value as typeof settings.motion,
                        })
                      }
                    >
                      <option value="system">Follow system</option>
                      <option value="reduced">Reduced</option>
                      <option value="full">Full</option>
                    </select>
                  </label>
                  <label>
                    Rendering quality
                    <select
                      value={settings.quality}
                      onChange={(e) =>
                        updateSettings({
                          quality: e.target.value as typeof settings.quality,
                        })
                      }
                    >
                      <option value="low">Low — no background effects</option>
                      <option value="balanced">Balanced</option>
                      <option value="high">High — richer atmosphere</option>
                    </select>
                  </label>
                  <label>
                    Text size
                    <select
                      value={settings.fontScale}
                      onChange={(e) =>
                        updateSettings({ fontScale: Number(e.target.value) })
                      }
                    >
                      <option value="0.85">Small</option>
                      <option value="1">Default</option>
                      <option value="1.2">Large</option>
                      <option value="1.5">Largest</option>
                    </select>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={settings.contrast}
                      onChange={(e) =>
                        updateSettings({ contrast: e.target.checked })
                      }
                    />
                    High contrast
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={settings.sounds}
                      onChange={(e) =>
                        updateSettings({ sounds: e.target.checked })
                      }
                    />
                    Original selection tone
                  </label>
                  <label>
                    Search shortcut (Ctrl / Cmd + letter)
                    <input
                      maxLength={1}
                      value={settings.shortcut}
                      onChange={(e) => {
                        if (/^[a-z]$/.test(e.target.value.toLowerCase()))
                          updateSettings({
                            shortcut: e.target.value.toLowerCase(),
                          });
                      }}
                    />
                  </label>
                </section>
                <section className="card">
                  <h2>
                    <Shield size={20} />
                    Content & trust
                  </h2>
                  <p>App 1.0.0 · Content {content.version}</p>
                  <p>{content.patch}</p>
                  <p>
                    Live verified:{" "}
                    {content.liveVerifiedAt ?? "No — verification pending"}
                  </p>
                  <Endpoint
                    value={settings.updateEndpoint}
                    onSave={(v) => updateSettings({ updateEndpoint: v })}
                  />
                  <div className="toolbar">
                    <button
                      disabled={busy || !settings.updateEndpoint}
                      onClick={() => {
                        setBusy(true);
                        void updateContent(settings.updateEndpoint)
                          .then(() => refresh())
                          .then(() => setNotice("Signed content installed."))
                          .catch((e) => setNotice(message(e)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      Check signed content
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void rollbackContent()
                          .then(() => refresh())
                          .then(() => setNotice("Previous content restored."))
                          .catch((e) => setNotice(message(e)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      Restore previous content
                    </button>
                  </div>
                  <p className="muted">
                    No public update feed or trusted publisher key ships with
                    this development build. Your offline package remains
                    available. App binary updates use manually verified
                    releases.
                  </p>
                  <details>
                    <summary>Sources & provenance</summary>
                    {content.sources.map((s) => (
                      <p key={s.id}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.label}
                        </a>
                        <br />
                        <small>
                          {s.license} · retrieved {s.retrievedAt}
                        </small>
                      </p>
                    ))}
                  </details>
                </section>
                <section className="card">
                  <h2>
                    <NotebookPen size={20} />
                    Personal data
                  </h2>
                  <p>
                    {isTauri()
                      ? "Stored in your local SQLite database."
                      : "Browser development mode stores personal data in this browser, independently of the desktop database."}{" "}
                    No accounts or telemetry.
                  </p>
                  <button
                    onClick={() =>
                      download(
                        `owguide-backup-${new Date().toISOString().slice(0, 10)}.json`,
                        user,
                      )
                    }
                  >
                    <Download size={16} />
                    Export backup
                  </button>
                  <label className="file-input">
                    <Upload size={16} />
                    Import backup (replaces personal data)
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void importFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={settings.diagnostics}
                      onChange={(e) =>
                        updateSettings({ diagnostics: e.target.checked })
                      }
                    />
                    Include technical details in diagnostic exports
                  </label>
                  <button
                    onClick={() =>
                      download("owguide-diagnostics.json", {
                        appVersion: "1.0.0",
                        contentVersion: content.version,
                        patch: content.patch,
                        rosterVerified: content.rosterVerified,
                        runtime: isTauri() ? "desktop" : "browser",
                        ...(settings.diagnostics
                          ? {
                              viewport: {
                                width: innerWidth,
                                height: innerHeight,
                              },
                              platform: navigator.platform,
                              events: diagnosticEvents(),
                            }
                          : {}),
                        note: "No personal notes, keys, URLs, or credential values included.",
                      })
                    }
                  >
                    Export diagnostics
                  </button>
                </section>
                <section className="card">
                  <h2>
                    <BookOpen size={20} />
                    What’s new
                  </h2>
                  <p>1.0.0 development candidate</p>
                  <ul>
                    <li>Offline hero selector and five guide sections</li>
                    <li>Transparent Counter Picker with evidence gaps</li>
                    <li>Notes, favorites, comparisons, and learning drills</li>
                    <li>Signed content pipeline and personal data backups</li>
                  </ul>
                  <p className="callout">
                    Production release is gated on live content review, Windows
                    package tests, and CI. This candidate is not a verified v1.0
                    release.
                  </p>
                </section>
              </div>
            </>
          )}
        </main>
        <footer className="footer">
          Independent fan companion · Not affiliated with Blizzard
          Entertainment.
          <span>
            <Shield size={12} />
            Evidence before rankings
          </span>
        </footer>
      </div>
    </div>
  );
}
