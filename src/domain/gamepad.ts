export type GamepadAction =
  "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Enter" | "Escape";
export function gamepadAction(
  pad: Pick<Gamepad, "mapping" | "axes" | "buttons">,
): GamepadAction | null {
  if (pad.mapping !== "standard") return null;
  const pressed = (index: number) => pad.buttons[index]?.pressed === true;
  if (pressed(1)) return "Escape";
  if (pressed(0)) return "Enter";
  if (pressed(14) || (pad.axes[0] ?? 0) < -0.6) return "ArrowLeft";
  if (pressed(15) || (pad.axes[0] ?? 0) > 0.6) return "ArrowRight";
  if (pressed(12) || (pad.axes[1] ?? 0) < -0.6) return "ArrowUp";
  if (pressed(13) || (pad.axes[1] ?? 0) > 0.6) return "ArrowDown";
  return null;
}
