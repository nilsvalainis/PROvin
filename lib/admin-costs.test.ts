import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminCostsChrome,
  adminCostsHref,
  buildCostDashboard,
  collectCostAlerts,
  costAlertBannerText,
  costAlertLevel,
  costGroupDot,
  costLimitCaption,
  costMonthRangeLabel,
  costRemainingCaption,
  costUsagePercent,
  formatAdminCostInt,
  formatAdminCostPercent,
  formatAdminCostUsd,
  formatCostUpdatedBadge,
  liveCostSourceIds,
  manualCostSourceIds,
  resolveCostMonth,
  shortCostLabel,
  type CostEvent,
  type CostLimit,
  type CostSnapshot,
} from "@/lib/admin-costs";
import { COST_SNAPSHOT_CRON_UTC_SCHEDULE } from "@/lib/admin-costs-refresh";

const NOW = Date.parse("2026-10-20T14:47:00.000+03:00");

function snap(source: CostSnapshot["source"], usd: number, units = 0, extra: Partial<CostSnapshot> = {}): CostSnapshot {
  return {
    source,
    sku: "",
    period: "2026-10",
    usd,
    units,
    fetchedAt: "2026-10-20T11:00:00.000Z",
    origin: "manual",
    ...extra,
  };
}

describe("admin cost format", () => {
  it("formats USD with comma and 2 decimals", () => {
    expect(formatAdminCostUsd(4.5)).toBe("4,50 $");
    expect(formatAdminCostUsd(88.37)).toBe("88,37 $");
    expect(formatAdminCostUsd(0)).toBe("0,00 $");
    expect(formatAdminCostPercent(24.4)).toBe("24 %");
    expect(formatAdminCostInt(1240)).toBe("1 240");
    expect(formatAdminCostInt(10000)).toBe("10 000");
  });

  it("formats updated badge in Riga without a dash", () => {
    expect(formatCostUpdatedBadge("2026-10-20T11:00:00.000Z", NOW)).toBe("atjaunināts 20.10. 14:00");
    expect(formatCostUpdatedBadge("2026-10-20T11:00:00.000Z", NOW)).not.toContain("\u2014");
    expect(formatCostUpdatedBadge("2026-10-20T11:00:00.000Z", NOW)).not.toContain("\u2013");
  });
});

describe("admin cost thresholds", () => {
  it("flags 80 % and 100 % against a limit", () => {
    expect(costUsagePercent(2.75, 4.5)).toBeCloseTo(61.111, 2);
    expect(costAlertLevel(costUsagePercent(2.75, 4.5))).toBeNull();
    expect(costAlertLevel(80)).toBe(80);
    expect(costAlertLevel(100)).toBe(100);
    expect(costAlertLevel(79.9)).toBeNull();
  });
});

describe("admin cost dashboard", () => {
  it("matches the approved mockup totals and Apify warning", () => {
    const events: CostEvent[] = [
      { id: "1", source: "anthropic", sku: "", units: 1, usd: 18.4, ref: "", createdAt: "2026-10-02T00:00:00.000Z" },
      { id: "2", source: "gemini", sku: "", units: 1, usd: 3.1, ref: "", createdAt: "2026-10-02T00:00:00.000Z" },
      { id: "3", source: "carfax", sku: "", units: 4, usd: 12, ref: "", createdAt: "2026-10-02T00:00:00.000Z" },
      { id: "4", source: "autodna", sku: "", units: 5, usd: 8.5, ref: "", createdAt: "2026-10-02T00:00:00.000Z" },
      { id: "5", source: "carvertical", sku: "", units: 2, usd: 6, ref: "", createdAt: "2026-10-02T00:00:00.000Z" },
      { id: "6", source: "statvin", sku: "", units: 6, usd: 3, ref: "", createdAt: "2026-10-02T00:00:00.000Z" },
    ];
    const snapshots: CostSnapshot[] = [
      snap("maps-dynamic", 0, 1240, { origin: "agent" }),
      snap("maps-geocoding", 0, 310, { origin: "agent" }),
      snap("vercel", 20),
      snap("fixie", 5),
      snap("stripe", 9.62),
    ];
    const limits: CostLimit[] = [
      { source: "anthropic", sku: "", period: "month", limitUsd: 40, limitUnits: null, hard: false, sourceOfLimit: "account", readAt: "2026-10-20T06:00:00.000Z" },
      { source: "gemini", sku: "", period: "month", limitUsd: 10, limitUnits: null, hard: false, sourceOfLimit: "account", readAt: "2026-10-20T06:00:00.000Z" },
      { source: "maps-dynamic", sku: "", period: "month", limitUsd: null, limitUnits: 10_000, hard: true, sourceOfLimit: "account", readAt: "2026-10-20T06:00:00.000Z" },
      { source: "maps-geocoding", sku: "", period: "month", limitUsd: null, limitUnits: 10_000, hard: true, sourceOfLimit: "account", readAt: "2026-10-20T06:00:00.000Z" },
    ];
    const dashboard = buildCostDashboard({
      month: "2026-10",
      nowMs: NOW,
      events,
      snapshots,
      limits,
      marketplace: { usd: 2.75, units: 11, capUsd: 4.5, perRunUsd: 0.25 },
    });
    expect(dashboard.totalUsd).toBe(88.37);
    expect(formatAdminCostUsd(dashboard.totalUsd)).toBe("88,37 $");
    expect(dashboard.rangeLabel).toBe("Kopā oktobrī (1.-20.10)");
    expect(Math.round(dashboard.groups.find((g) => g.id === "ai")!.percent)).toBe(24);
    expect(Math.round(dashboard.groups.find((g) => g.id === "api")!.percent)).toBe(36);
    expect(Math.round(dashboard.groups.find((g) => g.id === "infra")!.percent)).toBe(28);
    expect(Math.round(dashboard.groups.find((g) => g.id === "payments")!.percent)).toBe(11);
    const apify = dashboard.groups.flatMap((g) => g.sources).find((s) => s.id === "apify")!;
    expect(apify.usd).toBe(2.75);
    expect(apify.units).toBe(11);
    expect(apify.badge).toBe("live");
    expect(apify.subtitle).toContain("11 ielādes");
    expect(apify.subtitle).toContain("0,25 $");
    expect(costLimitCaption(apify)).toContain("4,50 $");
    const maps = dashboard.groups.flatMap((g) => g.sources).find((s) => s.id === "maps-dynamic")!;
    expect(costLimitCaption(maps)).toContain("1 240 / 10 000");
    expect(costRemainingCaption(maps)).toContain("8 760");
    expect(maps.hard).toBe(true);
    const alerts = collectCostAlerts(dashboard.groups.flatMap((g) => g.sources));
    expect(alerts).toHaveLength(0);
    const warnDash = buildCostDashboard({
      ...{
        month: "2026-10",
        nowMs: NOW,
        events,
        snapshots,
        limits,
        marketplace: { usd: 3.6, units: 14, capUsd: 4.5, perRunUsd: 0.25 },
      },
    });
    expect(warnDash.alerts[0]?.source).toBe("apify");
    expect(warnDash.alerts[0]?.level).toBe(80);
    expect(costAlertBannerText(warnDash.alerts)).toMatch(/Apify 80 %/);
    expect(costAlertBannerText(warnDash.alerts)).toContain("ielāde apstājas");
    expect(costAlertBannerText(warnDash.alerts)).not.toContain("\u2014");
  });

  it("keeps live vs stored sources split and clamps the month", () => {
    expect(liveCostSourceIds()).toEqual([
      "anthropic",
      "gemini",
      "apify",
      "carfax",
      "autodna",
      "carvertical",
      "statvin",
      "oneauto",
    ]);
    expect(manualCostSourceIds()).toEqual(["maps-dynamic", "maps-geocoding", "vercel", "fixie", "stripe"]);
    expect(resolveCostMonth(undefined, NOW)).toBe("2026-10");
    expect(resolveCostMonth("2026-09", NOW)).toBe("2026-09");
    expect(resolveCostMonth("2026-11", NOW)).toBe("2026-10");
    expect(costMonthRangeLabel("2026-09", NOW)).toBe("Kopā septembrī (1.-30.09)");
    expect(shortCostLabel("statvin")).toBe("stat.vin");
    expect(shortCostLabel("oneauto")).toBe("OneAuto");
  });
});

describe("admin cost workspace themes", () => {
  it("keeps one data layer and two hrefs / palettes", () => {
    expect(adminCostsHref("pro")).toBe("/admin/izmaksas");
    expect(adminCostsHref("iriss")).toBe("/admin/iriss/izmaksas");
    expect(adminCostsChrome("pro").crumb).toBe("Vairāk · PRO admin · Pārvaldība");
    expect(adminCostsChrome("iriss").crumb).toBe("Vairāk · IRISS admin · Pārvaldība");
    expect(adminCostsChrome("iriss").subtitle).toBe("IRISS · visi projekti");
    expect(costGroupDot("ai", "pro")).toBe("#1d1d1f");
    expect(costGroupDot("ai", "iriss")).toBe("#3d5bd9");
    expect(costGroupDot("api", "iriss")).not.toBe(costGroupDot("api", "pro"));
  });
});

describe("admin cost files", () => {
  it("does not make the costs header sticky and keeps admin auth", () => {
    const view = readFileSync(path.join(process.cwd(), "components/admin/AdminCostsView.tsx"), "utf8");
    expect(view).not.toMatch(/sticky/);
    expect(view).not.toMatch(/am-topbar-sticky/);
    expect(view).toMatch(/data-costs-theme=\{workspace\}/);
    expect(view).toMatch(/workspace: AdminCostsWorkspace/);
    const page = readFileSync(path.join(process.cwd(), "app/admin/(dashboard)/izmaksas/page.tsx"), "utf8");
    expect(page).toMatch(/requireAdminPage/);
    expect(page).toMatch(/workspace="pro"/);
    const irissPage = readFileSync(path.join(process.cwd(), "app/admin/iriss/izmaksas/page.tsx"), "utf8");
    expect(irissPage).toMatch(/requireAdminPage/);
    expect(irissPage).toMatch(/workspace="iriss"/);
    const api = readFileSync(path.join(process.cwd(), "app/api/admin/izmaksas/route.ts"), "utf8");
    expect(api).toMatch(/getAdminSession/);
    const thr = readFileSync(path.join(process.cwd(), "app/api/admin/izmaksas/thresholds/route.ts"), "utf8");
    expect(thr).toMatch(/getAdminSession/);
    const side = readFileSync(path.join(process.cwd(), "components/admin/AdminSidebar.tsx"), "utf8");
    expect(side).toMatch(/Pārvaldība/);
    expect(side).toMatch(/\/admin\/izmaksas/);
    expect(side).toMatch(/\/admin\/iriss\/izmaksas/);
    expect(side).toMatch(/iriss:\s*\[[\s\S]*I_SETTINGS[\s\S]*groupOps[\s\S]*I_IZMAKSAS/);
    const css = readFileSync(path.join(process.cwd(), "app/admin/admin-costs-theme.css"), "utf8");
    expect(css).toMatch(/data-costs-theme="pro"/);
    expect(css).toMatch(/data-costs-theme="iriss"/);
    expect(css).toMatch(/--acc/);
    expect(css).toMatch(/admin-costs-tab\[data-on="true"\][\s\S]*--costs-tab-on-fg/);
    const fixture = readFileSync(path.join(process.cwd(), "scripts/admin-costs-fixture.html"), "utf8");
    expect(fixture).toMatch(/data-costs-theme/);
    expect(fixture).toMatch(/theme === "iriss"/);
    expect(fixture).not.toContain("\u2014");
    const layout = readFileSync(path.join(process.cwd(), "app/admin/layout.tsx"), "utf8");
    expect(layout).toMatch(/admin-costs-theme\.css/);
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(vercel.crons.some((c) => c.path === "/api/cron/izmaksas-snapshots" && c.schedule === COST_SNAPSHOT_CRON_UTC_SCHEDULE)).toBe(
      true,
    );
  });
});
