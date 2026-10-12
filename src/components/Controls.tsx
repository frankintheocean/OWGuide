import { useState } from "react";
import { X } from "lucide-react";
import type { Hero } from "../domain/schema";

export function TeamSelect({
  title,
  selected,
  options,
  max,
  onChange,
}: {
  title: string;
  selected: string[];
  options: Hero[];
  max: number;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="team-select">
      <label>
        {title}
        <select
          aria-label={title}
          value=""
          disabled={selected.length >= max}
          onChange={(e) => {
            if (e.target.value && !selected.includes(e.target.value))
              onChange([...selected, e.target.value]);
          }}
        >
          <option value="">
            {selected.length >= max ? "Selection full" : "Add a hero…"}
          </option>
          {options
            .filter((h) => !selected.includes(h.id))
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} · {h.role}
              </option>
            ))}
        </select>
      </label>
      <div className="chips">
        {selected.map((id) => (
          <button
            key={id}
            onClick={() => onChange(selected.filter((x) => x !== id))}
            aria-label={`Remove ${options.find((h) => h.id === id)?.name ?? id}`}
          >
            {options.find((h) => h.id === id)?.name ?? id}
            <X size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}
export function Endpoint({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const valid = !draft || /^https:\/\//.test(draft);
  return (
    <>
      <label>
        Content manifest URL
        <input
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://your-domain/manifest.json"
        />
      </label>
      <button
        disabled={!valid || draft === value}
        onClick={() => onSave(draft)}
      >
        Save endpoint
      </button>
      {!valid && <small role="alert">Use an HTTPS URL.</small>}
    </>
  );
}
