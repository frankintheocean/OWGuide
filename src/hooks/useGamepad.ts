import { useEffect, useState, type RefObject } from "react";
import { gamepadAction, type GamepadAction } from "../domain/gamepad";

/** 🎮 Poll only while a standard controller is connected and the selector is active. */
export function useGamepad(
  grid: RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!active || !navigator.getGamepads) return;
    let frame = 0;
    let previous: GamepadAction | null = null;
    let nextRepeat = 0;
    const tick = (time: number) => {
      frame = 0;
      if (document.hidden || !document.hasFocus()) return;
      const pad = Array.from(navigator.getGamepads()).find(
        (p) => p?.connected && p.mapping === "standard",
      );
      setConnected(Boolean(pad));
      if (!pad) {
        previous = null;
        return;
      }
      const action = gamepadAction(pad);
      const changed = action !== previous;
      if (
        action &&
        (changed || (action.startsWith("Arrow") && time >= nextRepeat))
      ) {
        nextRepeat = time + (changed ? 400 : 140);
        if (action === "Escape")
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        else {
          const target = grid.current?.contains(document.activeElement)
            ? (document.activeElement as HTMLButtonElement)
            : grid.current?.querySelector<HTMLButtonElement>(
                ".hero-tile.selected, .hero-tile",
              );
          if (target) {
            target.focus();
            if (action === "Enter") target.click();
            else
              target.dispatchEvent(
                new KeyboardEvent("keydown", { key: action, bubbles: true }),
              );
          }
        }
      }
      previous = action;
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.hidden || !document.hasFocus()) {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = null;
      } else start();
    };
    window.addEventListener("gamepadconnected", start);
    window.addEventListener("gamepaddisconnected", start);
    window.addEventListener("focus", start);
    window.addEventListener("blur", visibility);
    document.addEventListener("visibilitychange", visibility);
    start();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("gamepadconnected", start);
      window.removeEventListener("gamepaddisconnected", start);
      window.removeEventListener("focus", start);
      window.removeEventListener("blur", visibility);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [grid, active]);
  return active && connected;
}
