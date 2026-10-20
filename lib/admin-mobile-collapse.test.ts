import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adminMobileThemeColor,
  ADMIN_MOBILE_CHROME_COMPACT_PX,
  ADMIN_MOBILE_CHROME_FULL_MAX_PX,
  ADMIN_MOBILE_LIST_PAD_BOTTOM_CSS,
  formatAdminMobileBadgeCount,
  nextAdminMobileChromeMode,
} from "@/lib/admin-mobile-collapse";

describe("nextAdminMobileChromeMode", () => {
  it("expands near the top", () => {
    expect(nextAdminMobileChromeMode(0, 40, "collapsed")).toBe("expanded");
    expect(nextAdminMobileChromeMode(9, 20, "collapsed")).toBe("expanded");
  });

  it("collapses after scrolling down more than 8 px", () => {
    expect(nextAdminMobileChromeMode(40, 9, "expanded")).toBe("collapsed");
    expect(nextAdminMobileChromeMode(40, 8, "expanded")).toBe("expanded");
  });

  it("expands after scrolling up more than 8 px", () => {
    expect(nextAdminMobileChromeMode(80, -9, "collapsed")).toBe("expanded");
    expect(nextAdminMobileChromeMode(80, -8, "collapsed")).toBe("collapsed");
  });
});

describe("admin mobile chrome metrics", () => {
  it("keeps compact bar at 44 pt and full header under 150 pt", () => {
    expect(ADMIN_MOBILE_CHROME_COMPACT_PX).toBe(44);
    expect(ADMIN_MOBILE_CHROME_FULL_MAX_PX).toBe(150);
    expect(ADMIN_MOBILE_LIST_PAD_BOTTOM_CSS).toContain("64px");
    expect(ADMIN_MOBILE_LIST_PAD_BOTTOM_CSS).toContain("16px");
  });

  it("maps theme-color to page background", () => {
    expect(adminMobileThemeColor("light")).toBe("#F2F2F7");
    expect(adminMobileThemeColor("dark")).toBe("#000000");
  });

  it("caps badge counts at 99+", () => {
    expect(formatAdminMobileBadgeCount(0)).toBe("");
    expect(formatAdminMobileBadgeCount(2)).toBe("2");
    expect(formatAdminMobileBadgeCount(99)).toBe("99");
    expect(formatAdminMobileBadgeCount(120)).toBe("99+");
  });
});

describe("admin mobile spec files", () => {
  it("ritina dokumentu un galveni kopā ar saturu", () => {
    const chrome = readFileSync(new URL("../components/admin/mobile/AdminMobileChrome.tsx", import.meta.url), "utf8");
    expect(chrome).not.toMatch(/nextAdminMobileChromeMode/);
    expect(chrome).not.toMatch(/requestAnimationFrame/);
    expect(chrome).not.toMatch(/am-topbar-sticky/);
    expect(chrome).toMatch(/am-topbar-expand/);
    expect(chrome).not.toMatch(/#admin-main-scroll/);
  });

  it("VIN SCAN un rīta kopsavilkums ir 36 pt pilles ar sheet", () => {
    const src = readFileSync(new URL("../components/admin/AdminOrderVinScanDashboardCards.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/h-9/);
    expect(src).toMatch(/Rīta kopsavilkums/);
    expect(src).toMatch(/VIN SCAN/);
    expect(src).toMatch(/AdminMobileSheet/);
    expect(src).not.toMatch(/rounded-\[18px\] bg-\[var\(--am-s1\)\] shadow-\[var\(--am-card-shadow\)\] md:hidden/);
  });

  it("tab bar: VIN īsā etiķete, badge klase, Vairāk z-0", () => {
    const side = readFileSync(new URL("../components/admin/AdminSidebar.tsx", import.meta.url), "utf8");
    expect(side).toMatch(/\{\s*\.\.\.VIN,\s*label:\s*"VIN"\s*\}/);
    expect(side).toMatch(/floating/);
    expect(side).toMatch(/fixed inset-0 z-\[20\]/);
    expect(side).not.toMatch(/z-\[40\]/);
    expect(side).toMatch(/whitespace-nowrap leading-none/);
    expect(side).toMatch(/Pārvaldība/);
    expect(side).toMatch(/\/admin\/izmaksas/);
    expect(side).toMatch(/\/admin\/iriss\/izmaksas/);
  });

  it("pavadzīmju pilles nav melnas un sludinājumos slēpjas", () => {
    const bar = readFileSync(new URL("../components/admin/IrissPavadzimesMobileBar.tsx", import.meta.url), "utf8");
    const strip = readFileSync(new URL("../components/admin/IrissPavadzimesPlateStrip.tsx", import.meta.url), "utf8");
    expect(strip).toMatch(/--fill-secondary/);
    expect(bar).not.toMatch(/item\.urgent \?/);
    expect(strip).not.toMatch(/item\.urgent \?/);
    expect(bar).toMatch(/sludinajumi/);
    expect(strip).toMatch(/animate-pulse/);
    expect(bar).not.toMatch(/scheduleAdminIdleWork/);
  });

  it("PRO kartītes ir kompaktas un galvenē paliek tikai +", () => {
    const orders = readFileSync(new URL("../components/admin/AdminOrdersTable.tsx", import.meta.url), "utf8");
    expect(orders).toMatch(/min-h-\[96px\]/);
    expect(orders).toMatch(/space-y-2/);
    expect(orders).toMatch(/AdminCreateManualOrderButton compact/);
    expect(orders).not.toMatch(/belowTitle \? <div className="mb-3">/);
  });

  it("meklēšanas poga ir 52 px un theme-color tiek sinhronizēts", () => {
    const search = readFileSync(new URL("../components/admin/AdminGlobalSearch.tsx", import.meta.url), "utf8");
    expect(search).toMatch(/h-\[52px\] w-\[52px\]/);
    const vp = readFileSync(new URL("../components/admin/useAdminMobileViewport.ts", import.meta.url), "utf8");
    expect(vp).toMatch(/useSyncAdminMobileThemeColor/);
    const shell = readFileSync(new URL("../components/admin/AdminShell.tsx", import.meta.url), "utf8");
    expect(shell).toMatch(/useSyncAdminMobileThemeColor/);
  });

  it("sludinājumu rīkjosla un logo rinda telefonā ir slēpta", () => {
    const list = readFileSync(new URL("../components/admin/IrissSludinajumiListClient.tsx", import.meta.url), "utf8");
    expect(list).toMatch(/hidden/);
    expect(list).toMatch(/md:block/);
    expect(list).not.toMatch(/admin-source-logo-row/);
    expect(list).not.toMatch(/IrissAuctionLogo/);
    expect(list).toMatch(/AdminMobileSegments/);
    const css = readFileSync(new URL("../app/admin/admin-mobile.css", import.meta.url), "utf8");
    expect(css).toMatch(/--bg:\s*#f2f2f7/i);
    expect(css).toMatch(/overflow-x:\s*hidden/);
    expect(css).toMatch(/min-height:\s*100dvh/);
  });
});
