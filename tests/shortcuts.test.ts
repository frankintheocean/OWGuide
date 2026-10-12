import { expect, it } from "vitest";
import { defaultUser, parseImport } from "../src/domain/schema";
import { navigationAction, navigationShortcuts } from "../src/domain/shortcuts";
it("retains legacy settings and resolves optional customized bindings", () => {
  const user = structuredClone(defaultUser);
  user.notes.personal = "Keep this note.";
  expect(parseImport(user).notes.personal).toBe("Keep this note.");
  expect(navigationShortcuts(user.settings.navigationShortcuts).heroes).toBe(
    "e",
  );
  user.settings.navigationShortcuts = { heroes: "x" };
  expect(parseImport(user).settings.navigationShortcuts?.heroes).toBe("x");
  expect(() =>
    parseImport({
      ...user,
      settings: { ...user.settings, navigationShortcuts: { home: "e" } },
    }),
  ).toThrow(/unique/);
  expect(
    parseImport({
      ...user,
      settings: {
        ...user.settings,
        navigationShortcuts: { home: "e", heroes: "" },
      },
    }).notes.personal,
  ).toBe("Keep this note.");
});
it("requires the intended modifiers and leaves AltGr typing alone", () => {
  const event = {
    key: "X",
    ctrlKey: true,
    metaKey: false,
    altKey: true,
    shiftKey: false,
    altGraph: false,
  };
  const shortcuts = navigationShortcuts({ heroes: "x" });
  expect(navigationAction(event, shortcuts)).toBe("heroes");
  expect(navigationAction({ ...event, altGraph: true }, shortcuts)).toBeNull();
  expect(navigationAction({ ...event, altKey: false }, shortcuts)).toBeNull();
  expect(navigationAction({ ...event, shiftKey: true }, shortcuts)).toBeNull();
  expect(
    navigationAction(event, navigationShortcuts({ heroes: "" })),
  ).toBeNull();
});
