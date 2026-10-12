import { useState } from "react";
import type { GameMap, Role } from "../domain/schema";
export function MapView({
  map,
  role,
  heroId,
  bookmarked = false,
  bookmarkDisabled = false,
  onBookmark,
}: {
  map: GameMap;
  role: Role | "all";
  heroId: string;
  bookmarked?: boolean;
  bookmarkDisabled?: boolean;
  onBookmark?: () => void;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [side, setSide] = useState("both"),
    [kind, setKind] = useState("all"),
    [floor, setFloor] = useState("all"),
    [active, setActive] = useState("");
  const markers = map.markers.filter(
    (p) =>
      (side === "both" || p.side === "both" || p.side === side) &&
      (kind === "all" || p.kind === kind) &&
      (floor === "all" || p.floor === floor) &&
      (role === "all" || !p.role || p.role === role) &&
      (!heroId || !p.heroIds.length || p.heroIds.includes(heroId)),
  );
  return (
    <section className="map-view">
      {onBookmark && (
        <button disabled={bookmarkDisabled} onClick={onBookmark}>
          {bookmarked ? "Remove map bookmark" : "Bookmark map"}
        </button>
      )}
      <div className="section-heading">
        <div>
          <p className="eyebrow">{map.modes.join(" / ")}</p>
          <h2>{map.name}</h2>
          <p>{map.location}</p>
        </div>
        <span className="badge">
          {map.currentVerified
            ? "Current map verified"
            : "Current availability unverified"}
        </span>
      </div>
      {map.asset ? (
        <>
          <div className="toolbar">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
            >
              −
            </button>
            <output aria-live="polite">{Math.round(zoom * 100)}%</output>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            >
              +
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset view
            </button>
            <label>
              Floor
              <select value={floor} onChange={(e) => setFloor(e.target.value)}>
                <option value="all">All floors</option>
                {[...new Set(map.markers.map((p) => p.floor))].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          </div>
          <div
            className="map-canvas"
            onPointerDown={(e) => {
              if (!(e.target as HTMLElement).closest("button"))
                e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (
                e.buttons === 1 &&
                e.currentTarget.hasPointerCapture(e.pointerId)
              )
                setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
            }}
          >
            <div
              className="map-layer"
              style={{
                transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              }}
            >
              <img
                src={map.asset.path}
                alt={`Licensed tactical view of ${map.name}`}
                draggable={false}
              />
              {markers.map((p) => (
                <button
                  key={p.id}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  className="map-marker"
                  aria-label={p.label}
                  onClick={() => setActive(p.id)}
                >
                  +
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="map-fallback">
          <span className="map-symbol" aria-hidden="true">
            ⌖
          </span>
          <h3>Text field guide</h3>
          <p>
            Accurate, rights-cleared map artwork and coordinates are not
            available in this content package. No geometry or tactical locations
            have been invented.
          </p>
        </div>
      )}
      {map.markers.length > 0 && (
        <div className="toolbar">
          <label>
            Side
            <select value={side} onChange={(e) => setSide(e.target.value)}>
              <option value="both">Both sides</option>
              <option value="attack">Attack</option>
              <option value="defense">Defense</option>
            </select>
          </label>
          <label>
            Marker
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">All markers</option>
              {["cover", "high-ground", "flank", "objective", "choke"].map(
                (k) => (
                  <option key={k}>{k}</option>
                ),
              )}
            </select>
          </label>
        </div>
      )}
      {markers.map((p) => (
        <article
          key={p.id}
          className={`card ${active === p.id ? "selected" : ""}`}
        >
          <button onClick={() => setActive(p.id)}>{p.label}</button>
          <p>{p.note}</p>
          <small>
            {p.side} · {p.floor} · {p.kind}
          </small>
        </article>
      ))}
      {map.notes.length ? (
        map.notes.map((note, i) => (
          <p className="card" key={i}>
            {note}
          </p>
        ))
      ) : (
        <p className="empty">
          Map-specific positions and routes await source review. Use the linked
          source to check map availability.
        </p>
      )}
    </section>
  );
}
