import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_MOBILE_TABBAR_DOCK_WRAPPER, IRISS_MOBILE_TAB_BOTTOM_CSS, IRISS_MOBILE_TABBAR_H_CSS } from "@/lib/admin-mobile-shell";

const files = {
  chrome: "components/admin/mobile/AdminMobileChrome.tsx",
  shell: "components/admin/AdminShell.tsx",
  bar: "components/admin/IrissPavadzimesMobileBar.tsx",
  room: "components/admin/IrissOrderRoom.tsx",
  editor: "components/admin/IrissPasutijumsEditor.tsx",
  range: "components/admin/IrissRangeFromToField.tsx",
  spec: "components/admin/IrissSpecDiapazoniBlock.tsx",
  list: "components/admin/IrissPasutijumiListClient.tsx",
  mobileCss: "app/admin/admin-mobile.css",
  irissTheme: "app/admin/admin-iriss-theme.css",
  irissAdmin: "app/admin/iriss/iriss-admin.css",
} as const;

const src = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, readFileSync(new URL(`../${file}`, import.meta.url), "utf8")]),
) as Record<keyof typeof files, string>;

describe("IRISS mobile safe-area layout", () => {
  it("keeps PRO and IRISS TopBar scrolling with content", () => {
    expect(src.chrome).not.toMatch(/am-topbar-sticky/);
    expect(src.chrome).not.toMatch(/nextAdminMobileChromeMode/);
    expect(src.chrome).not.toMatch(/data-stuck/);
    expect(src.chrome).toMatch(/am-topbar flex flex-col gap-2/);
    expect(src.chrome).toMatch(/className="am-topbar px-4 pb-2/);
    expect(src.chrome).toMatch(/safe-area-inset-top,0px\)\+8px/);
    expect(src.chrome).toMatch(/IrissPavadzimesMobileBar embedded/);
    expect(src.shell).not.toMatch(/IrissPavadzimesMobileBar/);
    expect(src.shell).toMatch(/IRISS_MOBILE_TABBAR_H_CSS/);
  });

  it("pins the tab dock to the screen edge with IRISS safe-area math", () => {
    expect(ADMIN_MOBILE_TABBAR_DOCK_WRAPPER).toMatch(/admin-m-tabbar-dock/);
    expect(ADMIN_MOBILE_TABBAR_DOCK_WRAPPER).not.toMatch(/gap-\[12pt\]/);
    expect(ADMIN_MOBILE_TABBAR_DOCK_WRAPPER).toMatch(/justify-center/);
    expect(ADMIN_MOBILE_TABBAR_DOCK_WRAPPER).not.toMatch(/inset-x-0/);
    expect(IRISS_MOBILE_TAB_BOTTOM_CSS).toBe("max(8px, calc(env(safe-area-inset-bottom, 0px) - 20px))");
    expect(IRISS_MOBILE_TABBAR_H_CSS).toContain("62px");
    expect(src.mobileCss).toMatch(/\.admin-m-tabbar-dock/);
    expect(src.irissTheme).toMatch(/--admin-tab-side:\s*16px/);
    expect(src.irissTheme).toMatch(/--admin-tab-bottom:\s*max\(8px/);
    expect(src.irissTheme).toMatch(/\.iriss-action-dock/);
  });

  it("keeps invoice chips in the last topbar row and hides them on the editor", () => {
    expect(src.bar).toMatch(/embedded/);
    // Numurzīmju josla augšā vairs netiek rādīta nevienā IRISS lapā.
    expect(src.bar).toMatch(/return null;/);
    expect(src.list).toMatch(/AdminMobileSearchField/);
    expect(src.list).toMatch(/IrissPasutijumiStatusFilter layout="scroll"/);
    expect(src.list).toMatch(/title="LIMITI"/);
    expect(src.list).toMatch(/opaque/);
    expect(src.chrome).toMatch(/opaque = false/);
    expect(src.chrome).toMatch(/admin-sheet-opaque/);
    expect(src.irissAdmin).toMatch(/\.admin-sheet-opaque/);
    expect(src.irissAdmin).toMatch(/\.iriss-limits-card/);
  });

  it("uses compact editor icons, scrolling tabs, and keeps Saglabāt", () => {
    expect(src.room).toContain("AdminDashboardHeaderWithMenu");
    expect(src.room).toMatch(/mobileTitle=\{title\}/);
    expect(src.room).toMatch(/AdminMobileSaveStatus/);
    expect(src.room).toMatch(/aria-label="Zvanīt"/);
    expect(src.room).toMatch(/aria-label="Atvērt WhatsApp"/);
    expect(src.room).not.toMatch(/grid grid-cols-3 gap-2 md:hidden/);
    expect(src.room).not.toMatch(/sticky top-0/);
    expect(src.room).toMatch(/iriss-action-dock/);
    expect(src.room).toMatch(/Saglabāt/);
    expect(src.editor).toMatch(/iriss-action-dock/);
    expect(src.editor).toMatch(/Saglabāt/);
    expect(src.range).toMatch(/phoneUnit/);
    expect(src.spec).toMatch(/phoneUnit="€"/);
    expect(src.spec).toMatch(/phoneUnit="g\."/);
    expect(src.irissAdmin).toMatch(/grid-template-columns: 100px minmax\(0, 1fr\)/);
    expect(src.irissAdmin).toMatch(/iriss-range-unit-phone/);
    expect(src.irissAdmin).toMatch(/\.iriss-range-unit-end \{\s*display: none;/);
  });

  it("keeps phone tap targets at 44px and sheets opaque", () => {
    expect(src.chrome).toMatch(/h-11 w-11/);
    expect(src.chrome).toMatch(/admin-sheet-opaque/);
    expect(src.mobileCss).toMatch(/height:\s*44px/);
    expect(src.mobileCss).toMatch(/\.iriss-status-chip \{[\s\S]*min-height:\s*44px/);
    expect(src.mobileCss).toMatch(/\.admin-sheet-panel\.am-glass/);
    expect(src.irissTheme).toMatch(/\.am-search \{[\s\S]*height:\s*44px/);
    expect(src.irissTheme).not.toMatch(/\.am-search \{[\s\S]*height:\s*36px/);
    expect(src.irissTheme).not.toMatch(/\.iriss-status-chip \{[\s\S]*height:\s*32px/);
  });
});
