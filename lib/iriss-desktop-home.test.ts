import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IRISS_DESKTOP_MEDIA, irissDesktopHomeHref, irissMobileMenuItemsFor } from "@/lib/iriss-mobile-menu";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("IRISS desktop home and sidebar", () => {
  it("opens Pasūtījumi on desktop for admins and the first allowed section for staff", () => {
    expect(irissDesktopHomeHref(irissMobileMenuItemsFor([], true))).toBe("/admin/iriss/pasutijumi");
    expect(irissDesktopHomeHref(irissMobileMenuItemsFor(["logistika"], false))).toBe("/admin/iriss/logistika");
    expect(irissDesktopHomeHref([])).toBeNull();
    expect(IRISS_DESKTOP_MEDIA).toBe("(min-width: 768px)");
  });

  it("keeps the menu list for phones only", () => {
    const menu = read("components/admin/IrissMobileMenuHome.tsx");
    expect(menu).toContain("router.replace(href)");
    expect(menu).toContain('className="px-4 md:hidden"');
    expect(menu).not.toContain("Izvēlies sadaļu sānjoslā vai zemāk.");
  });

  it("hides Sākums in the desktop sidebar and caps waybills at 2", () => {
    const sidebar = read("components/admin/AdminSidebar.tsx");
    expect(sidebar).toContain("g.items.filter((it) => it !== I_MENU)");
    expect(sidebar).toContain("IRISS_SIDEBAR_WAYBILL_LIMIT = 2");
    expect(sidebar).toContain('href="/admin/iriss/pasutijumi" onClick={() => writeWsCookie("iriss")}');
    const card = read("components/admin/IrissPavadzimesSidebarCard.tsx");
    // Visas 3 zīmes vienā kompaktā rindā (apļi), nevis saraksts ar limitu.
    expect(card).toContain("IrissWaybillGauges");
  });

  it("makes only the sidebar transparent, not panels or cards", () => {
    const css = read("app/admin/admin-iriss-theme.css");
    expect(css).toContain('.admin-m[data-section="iriss"] aside[data-iriss-nav] {');
    expect(css).not.toMatch(/\[data-section="iriss"\] aside \{/);
    expect(read("components/admin/AdminSidebar.tsx")).toContain('data-iriss-nav=""');
    expect(read("components/admin/IrissStaffAppShell.tsx")).toContain('data-iriss-nav=""');
  });
});
