import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = {
  chrome: "components/admin/mobile/AdminMobileChrome.tsx",
  shell: "components/admin/AdminShell.tsx",
  bar: "components/admin/IrissPavadzimesMobileBar.tsx",
  row: "components/admin/IrissPasutijumiListRow.tsx",
  pavadzimes: "components/admin/IrissPavadzimesListClient.tsx",
  sidebar: "components/admin/AdminSidebar.tsx",
  search: "components/admin/AdminGlobalSearch.tsx",
  logistika: "components/admin/iriss-logistika/IrissLogistikaClient.tsx",
  slud: "components/admin/IrissSludinajumiListClient.tsx",
  orders: "components/admin/AdminOrdersTable.tsx",
  mobileCss: "app/admin/admin-mobile.css",
  irissTheme: "app/admin/admin-iriss-theme.css",
  motion: "app/admin/admin-motion.css",
} as const;

const src = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, readFileSync(new URL(`../${file}`, import.meta.url), "utf8")]),
) as Record<keyof typeof files, string>;

describe("IRISS / PRO mobile audit guards", () => {
  it("does not pin the header", () => {
    expect(src.chrome).not.toMatch(/am-topbar-sticky/);
    expect(src.chrome).not.toMatch(/data-stuck/);
    expect(src.shell).not.toMatch(/am-topbar-sticky/);
  });

  it("does not ship the unapproved menu-home or IRISS/PRO dock switch", () => {
    expect(src.shell).toMatch(/AdminMobileSearchButton/);
    expect(src.shell).not.toMatch(/IRISS\s*<->\s*PRO/);
    expect(src.chrome).not.toMatch(/lv-plate|eu-band|mini-plate/);
    expect(src.bar).not.toMatch(/B193-7|B762-7|B192/);
    expect(src.logistika).not.toMatch(/mobileTitle="Izvēlne"|title="Izvēlne"/);
  });

  it("keeps waybill chips on current document labels, with 44px tap height", () => {
    expect(src.bar).toMatch(/min-h-11/);
    expect(src.bar).toMatch(/irissWaybillMobileBarItems/);
    expect(src.bar).not.toMatch(/displayDealerPlate/);
  });

  it("makes sheets and the global search panel opaque", () => {
    expect(src.chrome).toMatch(/admin-sheet-opaque/);
    expect(src.mobileCss).toMatch(/\.admin-sheet-panel\.am-glass/);
    expect(src.motion).toMatch(/background:\s*var\(--am-s1/);
    expect(src.search).toMatch(/bg-\[var\(--am-s1,#ffffff\)\]/);
    expect(src.search).not.toMatch(/am-glass flex min-h-0 flex-1 flex-col md:mx-auto/);
  });

  it("gives Loģistika a phone chrome and search field", () => {
    expect(src.logistika).toMatch(/AdminMobileTopBar/);
    expect(src.logistika).toMatch(/title="Loģistika"/);
    expect(src.logistika).toMatch(/AdminMobileSearchField/);
  });

  it("wraps Pavadzīmes toolbar and list cards on phone", () => {
    expect(src.pavadzimes).toMatch(/flex-wrap/);
    expect(src.pavadzimes).toMatch(/w-full min-w-0 rounded-\[22px\]/);
    expect(src.pavadzimes).not.toMatch(/w-\[min\(100%,280px\)\]/);
  });

  it("lets order card titles wrap instead of colliding with status", () => {
    expect(src.row).toMatch(/max-md:line-clamp-2/);
    expect(src.row).toMatch(/flex-col items-start gap-1 md:hidden/);
    expect(src.orders).toMatch(/max-md:line-clamp-2/);
  });

  it("keeps #376 Jaunie pills on --news-* and does not restyle them", () => {
    const admin = readFileSync(new URL("../app/admin/iriss/iriss-admin.css", import.meta.url), "utf8");
    expect(src.row).toMatch(/iriss-pas-hits/);
    expect(src.row).toMatch(/--news-bg/);
    expect(src.row).toMatch(/--news-fg/);
    expect(src.irissTheme).toMatch(/--news-bg:\s*var\(--ink\)/);
    expect(src.irissTheme).toMatch(/--news-fg:\s*var\(--onink\)/);
    expect(src.irissTheme).not.toMatch(/\.iriss-pas-hits\s*\{/);
    expect(src.mobileCss).not.toMatch(/\.iriss-pas-hits\s*\{/);
    expect(src.motion).not.toMatch(/\.iriss-pas-hits\s*\{/);
    expect(admin).toMatch(/\.iriss-pas-hits/);
    expect(admin).toMatch(/--news-bg,\s*var\(--ink/);
    expect(src.row).not.toMatch(/#2563eb/);
    expect(src.chrome).not.toMatch(/#2563eb/);
  });

  it("keeps the unapproved mockup in scripts only", () => {
    const mock = readFileSync(new URL("../scripts/iriss-mobile-mockups.html", import.meta.url), "utf8");
    expect(mock).toContain("IRISS sākums");
    expect(mock).toContain("Atpakaļ uz izvēlni");
    expect(mock).toContain("Kā tas savienojas");
    expect(mock).toContain("Sākums = izvēlne");
    expect(mock).toContain("B193-7");
    expect(mock).toContain("B762-7");
    expect(mock).toContain("class=\"switch\"");
    expect(mock).toContain("Sākums");
    expect(mock).toContain("#2563eb");
    expect(mock).toContain("--btn-dark-bg");
  });
});
