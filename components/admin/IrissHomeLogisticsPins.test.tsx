import { describe, expect, it } from "vitest";
import { IrissHomeLogisticsPins } from "@/components/admin/IrissHomeLogisticsPins";
import { irissHomeLogisticsPins } from "@/lib/iriss-home-logistics-pins";
import { emptyCargoPlan } from "@/lib/iriss-logistics-cargo-plan";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Loģistikas pin-i sākumā", () => {
  it("viss vidžets ir saite, bez virsraksta un bez Karte", () => {
    const pins = irissHomeLogisticsPins(emptyCargoPlan(), []);
    const html = renderHtml(<IrissHomeLogisticsPins href="/admin/iriss/logistika" pins={pins} />);
    const text = renderText(<IrissHomeLogisticsPins href="/admin/iriss/logistika" pins={pins} />);
    expect(html).toContain('href="/admin/iriss/logistika"');
    expect(html).toContain('aria-label="Loģistika"');
    expect(html).not.toContain("Karte");
    expect(html).not.toContain("Visas");
    expect(text).toContain("Nākošā");
    expect(text).toContain("Aiznākošā");
    expect(text).toContain("Gaida");
    expect(text).toContain("bez laika");
  });
});
