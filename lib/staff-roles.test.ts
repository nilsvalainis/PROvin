import { describe, expect, it } from "vitest";
import {
  decideAdminApiAccess,
  decideAdminPageAccess,
  isLogisticsApiPath,
  isLogisticsPagePath,
  isStaffPublicPagePath,
} from "@/lib/staff-roles";

describe("IRISS role path access (deny by default)", () => {
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

  it("keeps logistics on its prefix and nowhere else", () => {
    expect(isLogisticsPagePath("/admin/iriss/logistika")).toBe(true);
    expect(isLogisticsPagePath("/admin/iriss/logistika/2fa")).toBe(true);
    expect(isLogisticsPagePath("/admin/iriss/logistika-x")).toBe(false);
    expect(decideAdminPageAccess("/admin/iriss/logistika", { kind: "staff", role: "logistics" })).toBe("allow");
    expect(decideAdminPageAccess("/admin/iriss/pasutijumi", { kind: "staff", role: "logistics" })).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/dashboard", { kind: "staff", role: "logistics" })).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/iriss/iestatijumi", { kind: "staff", role: "logistics" })).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/partneri", { kind: "staff", role: "logistics" })).toBe("forbidden");
  });

  it("denies logistics every admin API except its prefix and logout", () => {
    expect(isLogisticsApiPath("/api/admin/iriss/logistika/points")).toBe(true);
    expect(decideAdminApiAccess("/api/admin/iriss/logistika/points", { kind: "staff", role: "logistics" })).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/logout", { kind: "staff", role: "logistics" })).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/badges", { kind: "staff", role: "logistics" })).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/iriss-pasutijumi", { kind: "staff", role: "logistics" })).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/partners", { kind: "staff", role: "logistics" })).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/staff/users", { kind: "staff", role: "logistics" })).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/orders/export", { kind: "none" })).toBe("unauthorized");
    expect(decideAdminApiAccess("/api/admin/badges", { kind: "admin" })).toBe("allow");
  });
});
