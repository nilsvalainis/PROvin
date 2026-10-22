import { describe, expect, it } from "vitest";
import { irissMenuCatalog, IRISS_DEFAULT_LAYOUT_IDS, PRO_DEFAULT_LAYOUT_IDS, proMenuCatalog } from "@/lib/admin-menu-catalog";
import { defaultMenuLayout } from "@/lib/admin-menu-layout";

describe("IRISS katalogs pēc tiesībām", () => {
  it("loģistikas loma redz loģistikas ikonu un logrīkus, bet ne izmaksas", () => {
    const ids = irissMenuCatalog(["logistika"], false).map((c) => c.id);
    expect(ids).toContain("logistika");
    expect(ids).toContain("w-logistika");
    expect(ids).not.toContain("w-pavadzimes");
    expect(ids).not.toContain("iestatijumi");
  });

  it("admins redz visu un noklusējuma izkārtojums ir pilnībā katalogā", () => {
    const cat = irissMenuCatalog([], true);
    const layout = defaultMenuLayout(cat, IRISS_DEFAULT_LAYOUT_IDS);
    expect(layout.length).toBe(IRISS_DEFAULT_LAYOUT_IDS.length);
    expect(cat.find((c) => c.id === "w-logistika")?.sizes).toEqual(["S", "M", "L"]);
  });
});

describe("PRO katalogs", () => {
  it("visas PRO sadaļas ir pieejamas kā ikonas, un noklusējums to atbilst", () => {
    const cat = proMenuCatalog();
    expect(cat.filter((c) => c.kind === "app").length).toBe(12);
    expect(defaultMenuLayout(cat, PRO_DEFAULT_LAYOUT_IDS).length).toBe(PRO_DEFAULT_LAYOUT_IDS.length);
  });
});
