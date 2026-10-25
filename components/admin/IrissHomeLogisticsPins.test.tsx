import { describe, expect, it } from "vitest";
import { IrissHomeLogisticsPins } from "@/components/admin/IrissHomeLogisticsPins";
import { irissHomeLogisticsPins } from "@/lib/iriss-home-logistics-pins";
import { emptyCargoPlan, moveCargoCar } from "@/lib/iriss-logistics-cargo-plan";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Loģistikas sākuma pin-i (v11d-fix stikls)", () => {
  it("rāda Nākošā / Aiznākošā / Gaida ar maketa pin krāsām", () => {
    let plan = emptyCargoPlan();
    plan = moveCargoCar(plan, "n1", "next");
    plan = moveCargoCar(plan, "a1", "after");
    const pins = irissHomeLogisticsPins(plan, [
      { id: "n1", pickupDate: "2026-10-25T14:30:00.000Z", pickupSnapshot: { city: "Rīga" } },
      { id: "a1", pickupDate: "2026-10-25T16:10:00.000Z", pickupSnapshot: { city: "Jelgava" } },
    ]);
    const html = renderHtml(<IrissHomeLogisticsPins href="/admin/iriss/logistika" pins={pins} />);
    const text = renderText(<IrissHomeLogisticsPins href="/admin/iriss/logistika" pins={pins} />);
    expect(html).toContain('href="/admin/iriss/logistika"');
    expect(html).toContain('aria-label="Loģistika"');
    expect(html).not.toContain("Karte");
    expect(html).not.toContain("Visas");
    expect(html).toContain("#30a46c");
    expect(html).toContain("#f08c00");
    expect(html).toContain("#a1a1aa");
    expect(text).toContain("Nākošā");
    expect(text).toContain("Aiznākošā");
    expect(text).toContain("Gaida");
    expect(text).toContain("14:30 · Rīga");
  });

  it("tukšam plānam paliek bez laika, bez virsraksta un bez Karte", () => {
    const pins = irissHomeLogisticsPins(emptyCargoPlan(), []);
    const html = renderHtml(<IrissHomeLogisticsPins href="/admin/iriss/logistika" pins={pins} />);
    const text = renderText(<IrissHomeLogisticsPins href="/admin/iriss/logistika" pins={pins} />);
    expect(html).toContain('aria-label="Loģistika"');
    expect(html).not.toContain("Karte");
    expect(text).toContain("bez laika");
  });
});
