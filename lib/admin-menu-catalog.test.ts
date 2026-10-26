import { describe, expect, it } from "vitest";
import { irissDefaultLayoutIds, irissMenuCatalog, IRISS_DEFAULT_LAYOUT_IDS, PRO_DEFAULT_LAYOUT_IDS, proMenuCatalog } from "@/lib/admin-menu-catalog";
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
    expect(cat.find((c) => c.id === "w-logistika")?.sizes).toEqual(["S", "M", "L", "app"]);
    expect(cat.find((c) => c.id === "w-logistika")?.hideHead).toBe(true);
    expect(cat.find((c) => c.id === "w-pavadzimes")?.hideHead).toBe(true);
    expect(IRISS_DEFAULT_LAYOUT_IDS).toEqual([
      "autoparks",
      "pavadzimes",
      "logistika",
      "kravas",
      "vin",
      "pasutijumi",
      "sludinajumi",
      "radars",
    ]);
    expect(cat.find((c) => c.id === "kravas")?.title).toBe("Kravas");
    expect(cat.find((c) => c.id === "sludinajumi")?.tone).toContain("#4a95f5");
    expect(cat.find((c) => c.id === "radars")?.tone).toContain("#8a6cf0");
    expect(cat.find((c) => c.id === "pasutijumi")?.tone).toContain("#5d616b");
    expect(cat.find((c) => c.id === "vin")?.tone).toContain("#48484c");
    expect(cat.find((c) => c.id === "pavadzimes")?.tone).toBe("#0b6232");
  });
});

describe("IRISS Serviss logrīks (j69)", () => {
  it("darbiniekam ar Autoparks Serviss (ap_serviss) un ieslēgtu v2 ir logrīks Serviss uz Autoparks v2", () => {
    const cat = irissMenuCatalog(["ap_serviss"], false, { autoparksV2Visible: true });
    const w = cat.find((c) => c.id === "w-serviss");
    expect(w).toMatchObject({ kind: "widget", title: "Serviss", href: "/admin/iriss/autoparks-v2", section: "ap_serviss" });
    // Agrāk šim darbiniekam katalogs bija tukšs - sākumā nebija nekā.
    expect(defaultMenuLayout(cat, irissDefaultLayoutIds(false)).map((e) => e.id)).toEqual(["w-serviss"]);
  });

  it("bez v2 karoga vai bez ap_serviss logrīka nav", () => {
    expect(irissMenuCatalog(["ap_serviss"], false).map((c) => c.id)).not.toContain("w-serviss");
    expect(irissMenuCatalog(["ap_serviss"], false, { autoparksV2Visible: false }).map((c) => c.id)).not.toContain("w-serviss");
    expect(irissMenuCatalog(["ap_pamatdati", "logistika"], false, { autoparksV2Visible: true }).map((c) => c.id)).not.toContain("w-serviss");
  });

  it("Serviss kopā ar citām sadaļām: logrīks režģī pirmais, pārējais paliek", () => {
    const cat = irissMenuCatalog(["pavadzimes", "ap_serviss"], false, { autoparksV2Visible: true });
    expect(defaultMenuLayout(cat, irissDefaultLayoutIds(false)).map((e) => e.id)).toEqual(["w-serviss", "pavadzimes"]);
  });

  it("admins logrīku var pievienot, bet admina noklusējuma režģis nemainās", () => {
    expect(irissMenuCatalog([], true).map((c) => c.id)).toContain("w-serviss");
    expect(irissDefaultLayoutIds(true)).toEqual(IRISS_DEFAULT_LAYOUT_IDS);
  });
});

describe("PRO katalogs", () => {
  it("visas PRO sadaļas ir pieejamas kā ikonas, un noklusējums to atbilst", () => {
    const cat = proMenuCatalog();
    expect(PRO_DEFAULT_LAYOUT_IDS.slice(0, 3)).toEqual(["w-pro-mini", "w-pro-dileri", "w-pro-ienemumi"]);
    expect(cat.filter((c) => c.kind === "widget").every((c) => c.sizes.includes("app"))).toBe(true);
    expect(cat.filter((c) => c.kind === "app").length).toBe(12);
    expect(defaultMenuLayout(cat, PRO_DEFAULT_LAYOUT_IDS).length).toBe(PRO_DEFAULT_LAYOUT_IDS.length);
  });
});
