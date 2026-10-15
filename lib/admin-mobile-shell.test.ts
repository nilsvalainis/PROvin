import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_MOBILE_PTR_THRESHOLD_PX, adminMobilePtrLabel, adminMobilePullToRefreshEnabled } from "@/lib/admin-mobile-shell";

describe("adminMobilePtrLabel", () => {
  it("rāda atjaunošanu, slieksni un vilkšanu", () => {
    expect(adminMobilePtrLabel(true, 10)).toBe("Atjauno sarakstu…");
    expect(adminMobilePtrLabel(false, ADMIN_MOBILE_PTR_THRESHOLD_PX)).toBe("Atlaid, lai atjaunotu");
    expect(adminMobilePtrLabel(false, 20)).toBe("Velc, lai atjaunotu");
    expect(adminMobilePtrLabel(false, 0)).toBe("");
  });
});

describe("adminMobilePullToRefreshEnabled", () => {
  it("ieslēdz vilkšanu pasūtījumu sarakstam, istabai un LIST", () => {
    expect(adminMobilePullToRefreshEnabled("/admin/iriss/pasutijumi")).toBe(true);
    expect(adminMobilePullToRefreshEnabled("/admin/iriss/pasutijumi/order-1")).toBe(true);
    expect(adminMobilePullToRefreshEnabled("/admin/iriss/sludinajumi")).toBe(true);
    expect(adminMobilePullToRefreshEnabled("/admin/orders/abc")).toBe(false);
  });
});

describe("admin mobile document scroll", () => {
  it("neaizslēdz html/body overflow mobilajā (pirksta ritināšana)", () => {
    const css = readFileSync(new URL("../app/admin/admin-ios-theme.css", import.meta.url), "utf8");
    const mobileHtmlBody = css.split("@media (max-width: 767px)")[1]?.split(".admin-ios-theme main")[0] ?? "";
    expect(mobileHtmlBody).toMatch(/overflow-y:\s*auto/);
    expect(mobileHtmlBody).toMatch(/touch-action:\s*pan-y pinch-zoom/);
    expect(mobileHtmlBody).not.toMatch(/overflow:\s*hidden/);
    expect(mobileHtmlBody).not.toMatch(/touch-action:\s*(?:none|manipulation)/);
    expect(mobileHtmlBody).not.toMatch(/height:\s*100dvh/);
  });
});
