import { describe, expect, it } from "vitest";
import {
  actorHomePath,
  decideAdminApiAccess,
  decideAdminPageAccess,
  IRISS_SECTION_CATALOG,
  isLogisticsApiPath,
  isLogisticsPagePath,
  isStaffPublicPagePath,
  normalizeStaffSections,
  sectionForAdminApiPath,
  sectionForAdminPagePath,
  staffHomePath,
  staffTabbarItems,
  type AccessActor,
} from "@/lib/staff-roles";

const logistics: AccessActor = { kind: "staff", sections: ["logistika"] };
const waybills: AccessActor = { kind: "staff", sections: ["pavadzimes"] };
const both: AccessActor = { kind: "staff", sections: ["logistika", "pavadzimes"] };

describe("IRISS section path access (deny by default)", () => {
  it("lets anyone open login and invite pages", () => {
    expect(decideAdminPageAccess("/admin/login", { kind: "none" })).toBe("allow");
    expect(decideAdminPageAccess("/admin/uzaicinajums/tok", { kind: "none" })).toBe("allow");
    expect(isStaffPublicPagePath("/admin/uzaicinajums/tok")).toBe(true);
  });

  it("sends anonymous visitors to login on every other admin page", () => {
    expect(decideAdminPageAccess("/admin/dashboard", { kind: "none" })).toBe("login");
    expect(decideAdminPageAccess("/admin/iriss/pasutijumi", { kind: "none" })).toBe("login");
    expect(decideAdminPageAccess("/admin/iriss/logistika", { kind: "none" })).toBe("login");
  });

  it("lets the env admin open every admin page", () => {
    expect(decideAdminPageAccess("/admin/iriss/pasutijumi", { kind: "admin" })).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/logistika", { kind: "admin" })).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/iestatijumi/lietotaji", { kind: "admin" })).toBe("allow");
  });

  it("keeps a logistics-only user on its prefix", () => {
    expect(isLogisticsPagePath("/admin/iriss/logistika")).toBe(true);
    expect(isLogisticsPagePath("/admin/iriss/logistika/2fa")).toBe(true);
    expect(isLogisticsPagePath("/admin/iriss/logistika-x")).toBe(false);
    expect(decideAdminPageAccess("/admin/iriss/logistika", logistics)).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/pasutijumi", logistics)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss/pavadzimes", logistics)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/dashboard", logistics)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss/iestatijumi", logistics)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/partneri", logistics)).toBe("forbidden");
  });

  it("lets one user hold Loģistika + Pavadzīmes and nothing else", () => {
    expect(decideAdminPageAccess("/admin/iriss/logistika", both)).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/pavadzimes", both)).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/pasutijumi", both)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss/sludinajumi", both)).toBe("forbidden");
    expect(staffHomePath(both.sections)).toBe("/admin/iriss");
    expect(actorHomePath(both)).toBe("/admin/iriss");
    expect(staffHomePath(waybills.sections)).toBe("/admin/iriss");
    expect(actorHomePath(waybills)).toBe("/admin/iriss");
    // Partneris (tikai Pavadzīmes): vienīgā lapa ir IRISS sākums ar pavadzīmju logrīku.
    expect(decideAdminPageAccess("/admin/iriss", waybills)).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/pavadzimes", waybills)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/iriss/waybill-requests", waybills)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/iriss/vpn", waybills)).toBe("forbidden");
    expect(actorHomePath({ kind: "admin" })).toBe("/admin/iriss");
  });

  it("maps pages and APIs to the granted section", () => {
    expect(sectionForAdminPagePath("/admin/iriss/pavadzimes")).toBe("pavadzimes");
    expect(sectionForAdminPagePath("/admin/vin-scan")).toBe("vin");
    expect(sectionForAdminApiPath("/api/admin/iriss-pavadzimes/x/pdf")).toBe("pavadzimes");
    expect(sectionForAdminApiPath("/api/admin/iriss-pasutijumi")).toBe("pasutijumi");
    expect(sectionForAdminApiPath("/api/admin/iriss-listings/sync-now")).toBe("sludinajumi");
  });

  it("denies logistics every admin API except its prefix, logout and totp", () => {
    expect(isLogisticsApiPath("/api/admin/iriss/logistika/points")).toBe(true);
    expect(isLogisticsApiPath("/api/admin/iriss-logistics/orders")).toBe(true);
    expect(decideAdminApiAccess("/api/admin/iriss/logistika/points", logistics)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/iriss-logistics/maps-config", logistics)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/logout", logistics)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/badges", logistics)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/iriss-pasutijumi", logistics)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/iriss-pavadzimes", logistics)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/partners", logistics)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/staff/users", logistics)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/orders/export", { kind: "none" })).toBe("unauthorized");
    expect(decideAdminApiAccess("/api/admin/badges", { kind: "admin" })).toBe("allow");
  });

  it("allows pavadzīmes APIs only with that section", () => {
    expect(decideAdminApiAccess("/api/admin/iriss-pavadzimes", waybills)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/iriss/waybill-requests", waybills)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/iriss/waybill-requests/wbr_1", waybills)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/iriss/logistika/points", waybills)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/iriss-pavadzimes", both)).toBe("allow");
  });

  it("gives Pavadzīmes-only staff zero access to other IRISS agents and sections", () => {
    // Partnerim vienīgā lapa ir IRISS sākums (pavadzīmju logrīks + forma); pavadzīmju API atļauts.
    expect(decideAdminPageAccess("/admin/iriss/pavadzimes", waybills)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss", waybills)).toBe("allow");
    for (const row of IRISS_SECTION_CATALOG) {
      if (row.id === "pavadzimes") continue;
      for (const page of row.pagePrefixes) {
        expect(decideAdminPageAccess(page, waybills), page).toBe("forbidden");
        expect(decideAdminPageAccess(`${page}/x`, waybills), `${page}/x`).toBe("forbidden");
      }
      for (const api of row.apiPrefixes) {
        expect(decideAdminApiAccess(api, waybills), api).toBe("forbidden");
        expect(decideAdminApiAccess(`${api}/x`, waybills), `${api}/x`).toBe("forbidden");
      }
    }
    const otherAgentApis = [
      "/api/admin/vin-scan",
      "/api/admin/vin-sources/fetch",
      "/api/admin/vin-history",
      "/api/admin/outvin/purchase",
      "/api/admin/csdd-tech-data",
      "/api/admin/iriss-marketplace/estimate",
      "/api/admin/iriss-listings/sync-now",
      "/api/admin/iriss-pasutijumi",
      "/api/admin/iriss-logistics/orders",
      "/api/admin/iriss-scan",
      "/api/admin/staff/users",
      "/api/admin/badges",
    ];
    for (const api of otherAgentApis) {
      expect(decideAdminApiAccess(api, waybills), api).toBe("forbidden");
    }
    expect(decideAdminPageAccess("/admin/vin-scan", waybills)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss/iestatijumi", waybills)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/dashboard", waybills)).toBe("forbidden");
  });

  it("treats a legacy logistics role as the Loģistika section", () => {
    expect(normalizeStaffSections(undefined, "logistics")).toEqual(["logistika"]);
    expect(normalizeStaffSections(["pavadzimes", "logistika", "pavadzimes"])).toEqual(["pavadzimes", "logistika"]);
  });

  it("lets Grāmatvede and Serviss open Loģistika APIs, not other IRISS pages", () => {
    const book: AccessActor = { kind: "staff", sections: ["gramatvede"] };
    const shop: AccessActor = { kind: "staff", sections: ["serviss"] };
    expect(decideAdminPageAccess("/admin/iriss/logistika", book)).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/logistika", shop)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/iriss-logistics/orders", book)).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/iriss-logistics/documents/x", shop)).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/pasutijumi", book)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss/pavadzimes", shop)).toBe("forbidden");
  });
});

describe("staffTabbarItems (D: josla tikai pēc tiesībām)", () => {
  it("partnerim (tikai Pavadzīmes) joslas nav", () => {
    expect(staffTabbarItems(["pavadzimes"], true)).toEqual([]);
  });

  it("tikai Loģistika: Sākums, Loģistika, Iziet - bez Autoparks un Pavadzīmēm", () => {
    expect(staffTabbarItems(["logistika"], true).map((i) => i.label)).toEqual(["Sākums", "Loģistika", "Iziet"]);
  });

  it("Pavadzīmes + Serviss: Autoparks ir, Loģistikas nav", () => {
    const labels = staffTabbarItems(["pavadzimes", "ap_serviss", "ap_summas"], true).map((i) => i.label);
    expect(labels).toEqual(["Sākums", "Pavadzīmes", "Autoparks", "Iziet"]);
    expect(labels).not.toContain("Loģistika");
    expect(labels).not.toContain("Pasūtījumi");
  });

  it("bez v2 karoga Autoparks cilnes nav, arī ja ir ap_*", () => {
    expect(staffTabbarItems(["pavadzimes", "ap_serviss"], false).map((i) => i.label)).toEqual([
      "Sākums",
      "Pavadzīmes",
      "Iziet",
    ]);
  });
});
