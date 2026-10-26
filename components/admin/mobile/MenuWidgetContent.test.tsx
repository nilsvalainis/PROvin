import { describe, expect, it } from "vitest";
import { renderIrissWidget, type MenuWidgetData } from "@/components/admin/mobile/MenuWidgetContent";
import { irissMenuCatalog } from "@/lib/admin-menu-catalog";
import { renderText } from "@/lib/test-render";

const data: MenuWidgetData = { irissLogistics: 0, irissMatches: 0, waybills: [], waybillsLoaded: true, pro: null, openCount: 0 };

describe("IRISS Serviss logrīka saturs (j69)", () => {
  it("rāda paskaidrojumu, nevis tukšu kartīti", () => {
    const item = irissMenuCatalog(["ap_serviss"], false, { autoparksV2Visible: true }).find((c) => c.id === "w-serviss")!;
    expect(renderText(<>{renderIrissWidget(item, "S", data)}</>)).toBe("Autoparka serviss");
  });
});
