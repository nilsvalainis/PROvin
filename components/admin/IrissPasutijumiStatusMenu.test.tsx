import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IRISS_PASUTIJUMI_STATUS_MENU_CLASS, IrissPasutijumiStatusMenuSurface } from "@/components/admin/IrissPasutijumiStatusMenu";
import { IRISS_ANCHORED_POPOVER_Z, placeAnchoredPopover } from "@/lib/iriss-anchored-popover";
import { renderHtml, renderText } from "@/lib/test-render";

describe("IRISS pasūtījumu statusa izvēlne (atvērta)", () => {
  it("rāda Aktīvs un Rezervēts fiksētā izvēlnē virs nākamās rindas", () => {
    const html = renderHtml(
      <IrissPasutijumiStatusMenuSurface currentStatus="reserved" style={{ top: 156, left: 234 }} />,
    );
    const text = renderText(
      <IrissPasutijumiStatusMenuSurface currentStatus="reserved" style={{ top: 156, left: 234 }} />,
    );
    expect(html).toContain('role="menu"');
    expect(html).toContain('role="menuitem"');
    expect(html).toContain('data-iriss-anchored-popover=""');
    expect(html).toContain("iriss-ov-menu-portal");
    expect(html).toContain("fixed");
    expect(html).toContain("z-[200]");
    expect(html).toContain("top:156px");
    expect(html).toContain("left:234px");
    expect(text).toContain("Aktīvs");
    expect(text).toContain("Rezervēts");
    expect(text).toContain("Izpildīts");
    expect(text).toContain("Neaktīvs");
    expect(IRISS_PASUTIJUMI_STATUS_MENU_CLASS).toContain("fixed");
    expect(IRISS_ANCHORED_POPOVER_Z).toBe(200);
  });

  it("novieto izvēlni zem pogas, lai nākamā rinda to neapgrieztu", () => {
    const placed = placeAnchoredPopover({
      anchor: { top: 120, left: 282, right: 370, bottom: 156, width: 88, height: 36 },
      menu: { width: 136, height: 168 },
      viewport: { width: 390, height: 844 },
      align: "end",
    });
    expect(placed.placement).toBe("below");
    expect(placed.top).toBe(162);
    expect(placed.left).toBe(234);
  });
});

describe("IRISS saraksta rindas statusa izvēlne iet caur portālu", () => {
  it("nepatur izvēlni overflow-x-clip kartītē", () => {
    const row = readFileSync("components/admin/IrissPasutijumiListRow.tsx", "utf8");
    const popover = readFileSync("components/admin/IrissAnchoredPopover.tsx", "utf8");
    expect(row).toContain("IrissAnchoredPopover");
    expect(row).toContain("IrissPasutijumiStatusMenuItems");
    expect(row).not.toMatch(/absolute right-3 top-\[3\.1rem\]/);
    expect(popover).toContain("createPortal");
    expect(popover).toContain("document.body");
    expect(popover).toContain("iriss-ov-menu-portal");
  });
});
