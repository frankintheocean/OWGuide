import { createRoot } from "react-dom/client";
import { MapView } from "../src/components/MapView";
import type { GameMap } from "../src/domain/schema";
import "../src/styles.css";
const map: GameMap = {
  id: "test-fixture",
  name: "Synthetic test grid",
  modes: ["test only"],
  location: "Not a game map",
  currentVerified: false,
  notes: [],
  asset: {
    path: "/tests/assets/grid.svg",
    sourceId: "test",
    sha256: "0".repeat(64),
    license: "Original test asset",
  },
  review: {
    sourceId: "test",
    patch: "test",
    reviewedAt: null,
    confidence: "low",
    stale: true,
  },
  markers: [
    {
      id: "one",
      label: "Test cover",
      kind: "cover",
      side: "attack",
      floor: "ground",
      x: 25,
      y: 50,
      heroIds: [],
      role: null,
      note: "Synthetic cover marker test",
      sourceId: "test",
    },
    {
      id: "two",
      label: "Test objective",
      kind: "objective",
      side: "defense",
      floor: "upper",
      x: 75,
      y: 50,
      heroIds: [],
      role: null,
      note: "Synthetic objective marker test",
      sourceId: "test",
    },
  ],
};
createRoot(document.getElementById("root")!).render(
  <div className="app">
    <main style={{ width: 700, padding: 25 }}>
      <MapView map={map} role="all" heroId="" />
    </main>
  </div>,
);
