import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = {
  page: "app/admin/iriss/page.tsx",
  menu: "components/admin/IrissMobileMenuHome.tsx",
  shell: "components/admin/AdminShell.tsx",
  chrome: "components/admin/mobile/AdminMobileChrome.tsx",
  sidebar: "components/admin/AdminSidebar.tsx",
  bar: "components/admin/IrissPavadzimesMobileBar.tsx",
  strip: "components/admin/IrissPavadzimesPlateStrip.tsx",
  search: "components/admin/AdminGlobalSearch.tsx",
  index: "app/admin/page.tsx",
} as const;

const src = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, readFileSync(new URL(`../${file}`, import.meta.url), "utf8")]),
) as Record<keyof typeof files, string>;

describe("IRISS mobile menu home and workspace switch", () => {
  it("renders the menu at /admin/iriss instead of redirecting to Pasūtījumi", () => {
    expect(src.page).toContain("IrissMobileMenuHome");
    expect(src.page).not.toMatch(/staffActorHomePath/);
    expect(src.page).not.toMatch(/redirect\(staff/);
    expect(src.index).toContain('"/admin/iriss"');
    expect(src.menu).toContain("IrissWaybillGauges");
    expect(src.menu).toContain("cheapIrissMenuCount");
  });

  it("defaults IRISS section back to the menu without editing Loģistika", () => {
    expect(src.chrome).toContain('"/admin/iriss"');
    expect(src.chrome).toContain("defaultBackHref");
    expect(src.chrome).toContain("isIrissMenuHome");
    expect(src.sidebar).toContain("I_MENU");
    expect(src.sidebar).toContain('label: L.irissMenu');
  });

  it("docks a search button next to the tab bar; IRISS/PRO switch lives in Vairāk", () => {
    expect(src.shell).toContain("<AdminMobileSearchButton />");
    expect(src.shell).not.toContain("AdminMobileWorkspaceSwitch");
    expect(src.search).toContain("export function AdminMobileSearchButton");
    expect(src.sidebar).toContain('aria-label="Darba zona"');
    expect(src.sidebar).toContain('onClick={() => writeWsCookie("pro")}');
  });

  it("keeps the header scrolling and plates without waybill numbers", () => {
    expect(src.chrome).not.toMatch(/am-topbar-sticky/);
    expect(src.bar).toContain("return null;");
    expect(src.strip).toContain("IrissMiniLvPlate");
    expect(src.strip).toContain("statusLabel");
    expect(src.strip).not.toContain("formatIrissWaybillChip");
    expect(src.strip).not.toMatch(/item\.number/);
  });

  it("sākuma hero ir bez Visas / Karte saitēm un ar float apļiem", () => {
    expect(src.menu).toContain('chrome="float"');
    expect(src.menu).toContain("IrissHomeLogisticsPins");
    expect(src.menu).not.toMatch(/<IrissWaybillGauges \/>/);
  });
});
