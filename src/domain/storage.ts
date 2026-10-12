import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  contentSchema,
  defaultUser,
  parseImport,
  type Content,
  type UserData,
} from "./schema";
export interface Snapshot {
  revision: number;
  user: UserData;
  content: Content;
}
const key = "owguide.personal.v1";
export async function load(retry = false): Promise<Snapshot> {
  if (isTauri()) {
    const s = await invoke<{
      revision: number;
      user: unknown;
      content: unknown;
    }>("load_data", { retry });
    return {
      revision: s.revision,
      user:
        s.user === null ? structuredClone(defaultUser) : parseImport(s.user),
      content: contentSchema.parse(s.content),
    };
  }
  const { bundledContent } = await import("./content");
  const raw = localStorage.getItem(key);
  if (!raw)
    return {
      revision: 0,
      user: structuredClone(defaultUser),
      content: bundledContent,
    };
  const s: unknown = JSON.parse(raw);
  if (
    !s ||
    typeof s !== "object" ||
    !("revision" in s) ||
    typeof s.revision !== "number" ||
    !("user" in s)
  )
    throw new Error(
      "Personal data is damaged. Export the browser storage before resetting it.",
    );
  return {
    revision: s.revision,
    user: parseImport(s.user),
    content: bundledContent,
  };
}
export async function save(user: UserData, revision: number) {
  const valid = parseImport(user);
  if (isTauri()) return invoke<number>("save_user", { user: valid, revision });
  if ((await load()).revision !== revision)
    throw new Error("Another window changed your data. Reload and retry.");
  localStorage.setItem(
    key,
    JSON.stringify({ revision: revision + 1, user: valid }),
  );
  return revision + 1;
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function quickReference() {
  if (isTauri()) await invoke("open_quick");
  else
    window.open(
      `${location.origin}/?quick=1`,
      "owguide-quick",
      "width=420,height=650",
    );
}
export async function updateContent(endpoint: string) {
  if (!isTauri())
    throw new Error("Signed content updates require the desktop app.");
  await invoke("update_content", { endpoint });
}
export async function rollbackContent() {
  if (!isTauri()) throw new Error("Content rollback requires the desktop app.");
  await invoke("rollback_content");
}

export async function openSource(url: string) {
  if (isTauri()) await invoke("open_source", { url });
}
