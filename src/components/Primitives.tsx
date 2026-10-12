import type { ReactNode } from "react";
import type { Role } from "../domain/schema";
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Missing() {
  return <span className="muted">Not yet reviewed</span>;
}
export function RoleFilter({
  value,
  onChange,
}: {
  value: Role | "all";
  onChange: (value: Role | "all") => void;
}) {
  return (
    <div className="segmented" aria-label="Hero role">
      {(["all", "tank", "damage", "support"] as const).map((r) => (
        <button key={r} aria-pressed={value === r} onClick={() => onChange(r)}>
          {r}
        </button>
      ))}
    </div>
  );
}
