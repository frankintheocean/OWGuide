interface Diagnostic {
  at: string;
  event: string;
}
const entries: Diagnostic[] = [];
export function record(
  event:
    | "data-loaded"
    | "data-save-failed"
    | "data-saved"
    | "load-failed"
    | "render-error"
    | "unhandled-rejection",
) {
  entries.push({ at: new Date().toISOString(), event });
  if (entries.length > 100) entries.shift();
}
export function diagnosticEvents() {
  return entries.map((e) => ({ ...e }));
}
