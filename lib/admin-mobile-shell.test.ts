import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADMIN_MOBILE_BADGE_POLL_MS,
  ADMIN_MOBILE_PTR_THRESHOLD_PX,
  ADMIN_MOBILE_SECONDARY_DELAY_MS,
  ADMIN_MOBILE_TABBAR_DOCK_NAV,
  ADMIN_MOBILE_TABBAR_DOCK_WRAPPER,
  adminMobilePtrLabel,
  adminMobilePullToRefreshEnabled,
  scheduleAdminIdleWork,
} from "@/lib/admin-mobile-shell";

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

describe("admin mobile perf constants", () => {
  it("keeps desktop badge poll faster than mobile", () => {
    expect(ADMIN_MOBILE_BADGE_POLL_MS).toBeGreaterThan(45_000);
    expect(ADMIN_MOBILE_SECONDARY_DELAY_MS).toBeGreaterThan(0);
  });

  it("scheduleAdminIdleWork atceļ timeout", () => {
    let ran = false;
    const cancel = scheduleAdminIdleWork(() => {
      ran = true;
    }, 20);
    cancel();
    expect(ran).toBe(false);
  });
});

describe("admin mobile css selectors", () => {
  it("uses descendant .admin-ios-theme .admin-m, not a compound class", () => {
    const css = readFileSync(new URL("../app/admin/admin-mobile.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.admin-ios-theme \.admin-m/);
    expect(css).not.toMatch(/\.admin-m\.admin-ios-theme/);
    expect(css).toMatch(/html:has\(\.admin-m\)/);
    expect(css).toMatch(/\.admin-m\[data-admin-theme="dark"\]/);
    expect(css).not.toMatch(/@media \(prefers-color-scheme: dark\)[\s\S]*\.admin-m \{/);
  });

  it("exports Safari theme-color for admin layout", () => {
    const layout = readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");
    expect(layout).toMatch(/themeColor:/);
    expect(layout).toMatch(/#F2F2F7/);
    expect(layout).toMatch(/viewportFit: "cover"/);
    expect(layout).toMatch(/manifest.webmanifest/);
  });
});

describe("admin mobile tab dock", () => {
  it("keeps 12pt only between the glass capsule and search", () => {
    expect(ADMIN_MOBILE_TABBAR_DOCK_WRAPPER).toMatch(/gap-\[12pt\]/);
    expect(ADMIN_MOBILE_TABBAR_DOCK_NAV).toMatch(/gap-0/);
    expect(ADMIN_MOBILE_TABBAR_DOCK_NAV).not.toMatch(/gap-\[12pt\]/);
  });
});

describe("admin mobile VIN SCAN row", () => {
  it("keeps the VIN SCAN card under the title even with zero jobs", () => {
    const src = readFileSync(new URL("../components/admin/AdminOrderVinScanDashboardCards.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/VIN SCAN/);
    expect(src).not.toMatch(/\{cards\.length > 0 \? \(/);
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

  it("ritina dokumentu, ne #admin-main-scroll", () => {
    const css = readFileSync(new URL("../app/admin/admin-ios-theme.css", import.meta.url), "utf8");
    expect(css).toMatch(/#admin-main-scroll \{[\s\S]*overflow:\s*visible !important/);
    const shell = readFileSync(new URL("../components/admin/AdminShell.tsx", import.meta.url), "utf8");
    expect(shell).not.toMatch(/max-md:h-dvh/);
    const main = readFileSync(new URL("../components/admin/AdminShellMainWithMobilePull.tsx", import.meta.url), "utf8");
    expect(main).toMatch(/max-md:p-0/);
  });
});
