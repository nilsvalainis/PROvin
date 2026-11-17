import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sidebar = readFileSync("components/admin/AdminSidebar.tsx", "utf8");

describe("telefona apakšējā josla un ielāde", () => {
  it("navigates tabs as plain links without a view transition that blocks taps", () => {
    expect(sidebar).not.toMatch(/startAdminViewTransition/);
    expect(sidebar).not.toMatch(/router\.push\(href\)/);
    expect(sidebar).toContain("setPendingHref(home.href)");
    expect(sidebar).toContain("const shownPath = pendingHref ?? pathname;");
  });

  it("closes the Vairāk sheet right away when switching PRO / IRISS", () => {
    expect(sidebar).toMatch(/writeWsCookie\("pro"\);\s*setMore\(false\);/);
    expect(sidebar).toMatch(/writeWsCookie\("iriss"\);\s*setMore\(false\);/);
  });

  it("shows a loading state immediately for admin and IRISS pages", () => {
    expect(existsSync("app/admin/loading.tsx")).toBe(true);
    expect(existsSync("app/admin/iriss/loading.tsx")).toBe(true);
  });
});
