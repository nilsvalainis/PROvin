import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IRISS_MOBILE_TABBAR_H_CSS } from "@/lib/admin-mobile-shell";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const mobileCss = read("app/admin/admin-mobile.css");
const ap2Css = read("app/admin/iriss/autoparks-v2/autoparks-v2.css");
const pickerCss = read("components/admin/IrissWaybillMobileForm.module.css");
const sidebar = read("components/admin/AdminSidebar.tsx");
const chrome = read("components/admin/mobile/AdminMobileChrome.tsx");

describe("iPhone drošās zonas (Nils 20.11)", () => {
  it("statusa joslai fiksēta fona josla, galvene nav sticky", () => {
    expect(mobileCss).toMatch(/body:has\(\.admin-m\)::before\s*\{[^}]*position:\s*fixed[^}]*height:\s*env\(safe-area-inset-top/);
    expect(chrome).not.toMatch(/am-topbar[^"]*sticky/);
  });

  it("apakšā vieta peldošajai joslai + safe-area", () => {
    expect(IRISS_MOBILE_TABBAR_H_CSS).toMatch(/62px/);
    expect(IRISS_MOBILE_TABBAR_H_CSS).toMatch(/\+ env\(safe-area-inset-bottom, 0px\) \+ 24px/);
    expect(sidebar).toMatch(/pb-\[calc\(64px\+var\(--admin-tab-bottom,16px\)\+env\(safe-area-inset-bottom,0px\)\+24px\)\]/);
  });

  it("kartītes darbību joslai necaurspīdīgs fons un saturam apakšas atkāpe", () => {
    expect(mobileCss).toMatch(/\.iriss-action-dock\s*\{[^}]*background:\s*#e9ecf1/);
    expect(mobileCss).toMatch(/:has\(\.iriss-action-dock\)\s*\{[^}]*padding-bottom:/);
  });

  it("auto izvēles meklēšana ar fonu, saraksts zem tās", () => {
    expect(pickerCss).toMatch(/\.picker\.pickerInSheet \.searchBar\s*\{[^}]*position:\s*sticky[^}]*background:/);
  });

  it("problēmu rinda kompakta - dzēšanas poga neizstiepj rindu", () => {
    expect(ap2Css).toMatch(/\.ap2-sv-pt \.ap2-sv-del\s*\{[^}]*margin:\s*-9px/);
  });
});
