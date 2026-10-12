export const navigationDefaults = {
  home: "h",
  heroes: "e",
  counter: "c",
  maps: "m",
  compare: "p",
  journal: "n",
  settings: "s",
  quick: "q",
} as const;
export type NavigationAction = keyof typeof navigationDefaults;
export type NavigationShortcuts = Record<NavigationAction, string>;
export const navigationLabels: Record<NavigationAction, string> = {
  home: "Dashboard",
  heroes: "Heroes",
  counter: "Counter Picker",
  maps: "Maps",
  compare: "Compare",
  journal: "Notebook",
  settings: "Settings",
  quick: "Quick Reference",
};
export function navigationShortcuts(
  custom?: Partial<NavigationShortcuts>,
): NavigationShortcuts {
  return { ...navigationDefaults, ...custom };
}
export function navigationAction(
  event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    altGraph: boolean;
  },
  shortcuts: NavigationShortcuts,
) {
  if (
    !(event.ctrlKey || event.metaKey) ||
    !event.altKey ||
    event.shiftKey ||
    event.altGraph
  )
    return null;
  const key = event.key.toLowerCase();
  if (!/^[a-z]$/.test(key)) return null;
  return (
    (Object.keys(shortcuts) as NavigationAction[]).find(
      (action) => shortcuts[action] === key,
    ) ?? null
  );
}
