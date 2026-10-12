import { useLayoutEffect, useRef, useState } from "react";
interface Entry {
  key: string;
  label: string;
}
interface Props {
  entries: Entry[];
  onSelect: (key: string) => void;
}
const rowHeight = 54;
export function NoteList({ entries, onSelect }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (focusIndex === null) return;
    viewport.current
      ?.querySelector<HTMLButtonElement>(`button[data-index="${focusIndex}"]`)
      ?.focus({ preventScroll: true });
    setFocusIndex(null);
  }, [focusIndex, scrollTop]);
  if (entries.length <= 80)
    return (
      <>
        {entries.map((entry) => (
          <button
            key={entry.key}
            className="list-row"
            onClick={() => onSelect(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </>
    );
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const end = Math.min(entries.length, start + 15);
  return (
    <div
      ref={viewport}
      className="note-viewport"
      role="region"
      aria-label="Saved notes list"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onKeyDown={(e) => {
        const current = Number((e.target as HTMLElement).dataset.index);
        if (!Number.isInteger(current)) return;
        const delta =
          e.key === "ArrowDown"
            ? 1
            : e.key === "ArrowUp"
              ? -1
              : e.key === "PageDown"
                ? 6
                : e.key === "PageUp"
                  ? -6
                  : 0;
        if (!delta && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? entries.length - 1
              : Math.max(0, Math.min(entries.length - 1, current + delta));
        const container = e.currentTarget;
        if (
          next * rowHeight < container.scrollTop ||
          (next + 1) * rowHeight > container.scrollTop + container.clientHeight
        )
          container.scrollTop = next * rowHeight;
        setScrollTop(container.scrollTop);
        setFocusIndex(next);
      }}
    >
      <div
        role="list"
        style={{ height: entries.length * rowHeight, position: "relative" }}
      >
        {entries.slice(start, end).map((entry, offset) => (
          <div
            key={entry.key}
            role="listitem"
            aria-posinset={start + offset + 1}
            aria-setsize={entries.length}
            style={{
              position: "absolute",
              top: (start + offset) * rowHeight,
              height: rowHeight,
              width: "100%",
            }}
          >
            <button
              className="list-row"
              data-index={start + offset}
              title={entry.label}
              onClick={() => onSelect(entry.key)}
            >
              {entry.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
