import { describe, expect, it } from "vitest";
import {
  addMenuEntry,
  defaultMenuLayout,
  menuRowsFor,
  menuSpan,
  missingMenuItems,
  moveMenuEntry,
  nextMenuSize,
  normalizeMenuLayout,
  removeMenuEntry,
  setMenuEntrySize,
  type MenuCatalogItem,
} from "@/lib/admin-menu-layout";

const catalog: MenuCatalogItem[] = [
  { id: "app-a", kind: "app", title: "A", href: "/a", sizes: ["app"], defaultSize: "app", icon: "list", tone: "#000" },
  { id: "w-waybills", kind: "widget", title: "Pavadzīmes", href: "/p", sizes: ["S", "M", "L"], defaultSize: "M", rowsBySize: { S: 2, M: 4, L: 6 }, icon: "doc", tone: "#000" },
  { id: "w-radar", kind: "widget", title: "Radars", href: "/r", sizes: ["S", "M"], defaultSize: "S", icon: "radar", tone: "#000" },
];
const byId = (id: string) => catalog.find((c) => c.id === id)!;

describe("menu izmēri", () => {
  it("ikonas 1×1, logrīki 2×2, 4×2, 4×4", () => {
    expect(menuSpan("app")).toEqual({ cols: 1, rows: 1 });
    expect(menuSpan("S")).toEqual({ cols: 2, rows: 2 });
    expect(menuSpan("M")).toEqual({ cols: 4, rows: 2 });
    expect(menuSpan("L")).toEqual({ cols: 4, rows: 4 });
  });

  it("rindu skaits seko izmēram (pavadzīmes 2 → 4 → 6)", () => {
    expect(menuRowsFor(byId("w-waybills"), "S")).toBe(2);
    expect(menuRowsFor(byId("w-waybills"), "M")).toBe(4);
    expect(menuRowsFor(byId("w-waybills"), "L")).toBe(6);
    expect(menuRowsFor(byId("app-a"), "app")).toBe(0);
  });

  it("cikls tikai pa atļautajiem izmēriem", () => {
    expect(nextMenuSize(byId("w-waybills"), "S")).toBe("M");
    expect(nextMenuSize(byId("w-waybills"), "L")).toBe("S");
    // Logrīku var samazināt līdz ikonai, ja katalogā atļauts.
    const withIcon = { ...byId("w-radar"), sizes: ["S", "M", "app"] as const };
    expect(nextMenuSize(withIcon, "M")).toBe("app");
    expect(nextMenuSize(withIcon, "app")).toBe("S");
    expect(nextMenuSize(byId("w-radar"), "M")).toBe("S");
    expect(nextMenuSize(byId("app-a"), "app")).toBe("app");
  });
});

describe("izkārtojuma saglabāšana", () => {
  const fallback = defaultMenuLayout(catalog, ["w-waybills", "app-a"]);

  it("noklusējums seko katalogam", () => {
    expect(fallback).toEqual([
      { id: "w-waybills", size: "M" },
      { id: "app-a", size: "app" },
    ]);
  });

  it("izmet nezināmus ID, dublikātus un nederīgus izmērus", () => {
    const raw = [
      { id: "nav", size: "S" },
      { id: "app-a", size: "app" },
      { id: "app-a", size: "L" },
      { id: "w-radar", size: "L" },
      { id: "w-waybills", size: "XXL" },
    ];
    expect(normalizeMenuLayout(raw, catalog, fallback)).toEqual([
      { id: "app-a", size: "app" },
      { id: "w-radar", size: "S" },
      { id: "w-waybills", size: "M" },
    ]);
  });

  it("nederīgs ieraksts atgriež noklusējumu", () => {
    expect(normalizeMenuLayout("bojāts", catalog, fallback)).toEqual(fallback);
    expect(normalizeMenuLayout([{ id: "nav" }], catalog, fallback)).toEqual(fallback);
  });
});

describe("kārtošana un rediģēšana", () => {
  const layout = [
    { id: "a", size: "app" as const },
    { id: "b", size: "app" as const },
    { id: "c", size: "app" as const },
  ];

  it("pārvieto un nepārsniedz robežas", () => {
    expect(moveMenuEntry(layout, 0, 2).map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(moveMenuEntry(layout, 2, -5).map((e) => e.id)).toEqual(["c", "a", "b"]);
    expect(moveMenuEntry(layout, 1, 1)).toBe(layout);
  });

  it("maina izmēru tikai uz atļauto", () => {
    const l2 = [{ id: "w-waybills", size: "M" as const }];
    expect(setMenuEntrySize(l2, catalog, "w-waybills", "L")).toEqual([{ id: "w-waybills", size: "L" }]);
    expect(setMenuEntrySize(l2, catalog, "w-radar", "L")).toBe(l2);
    expect(setMenuEntrySize(l2, catalog, "w-waybills", "app")).toBe(l2);
  });

  it("pievieno vienreiz un izņem", () => {
    const withRadar = addMenuEntry(layout, byId("w-radar"));
    expect(withRadar.at(-1)).toEqual({ id: "w-radar", size: "S" });
    expect(addMenuEntry(withRadar, byId("w-radar"))).toBe(withRadar);
    expect(removeMenuEntry(withRadar, "a").map((e) => e.id)).toEqual(["b", "c", "w-radar"]);
  });

  it("piedāvā tikai to, kā režģī vēl nav", () => {
    const withApp = [{ id: "app-a", size: "app" as const }];
    expect(missingMenuItems(withApp, catalog).map((c) => c.id)).toEqual(["w-waybills", "w-radar"]);
  });
});

describe("j23: pieskāriens ikonai, kamēr cita sadaļa vēl atveras", () => {
  it("otrs pieskāriens citai ikonai tiek ignorēts līdz MENU_TAP_GUARD_MS; tai pašai ikonai - atļauts", async () => {
    const { MENU_TAP_GUARD_MS, menuTapAllowed } = await import("@/lib/admin-menu-layout");
    const pending = { id: "pavadzimes", at: 1_000 };
    expect(menuTapAllowed(null, "pasutijumi", 1_000)).toBe(true);
    expect(menuTapAllowed(pending, "pasutijumi", 1_300)).toBe(false);
    expect(menuTapAllowed(pending, "pavadzimes", 1_300)).toBe(true);
    expect(menuTapAllowed(pending, "pasutijumi", 1_000 + MENU_TAP_GUARD_MS)).toBe(true);
  });
});
