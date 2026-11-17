import { describe, expect, it } from "vitest";
import { IrissHomeLogisticsPins } from "@/components/admin/IrissHomeLogisticsPins";
import { irissHomeLogisticsPins } from "@/lib/iriss-home-logistics-pins";
import { emptyCargoPlan, moveCargoCar } from "@/lib/iriss-logistics-cargo-plan";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Loģistikas sākuma pin-i (v11d-fix stikls)", () => {
  it("rāda Nākošā / Aiznākošā / Gaida ar maketa pin krāsām, bez sekundārās rindas", () => {
    let plan = emptyCargoPlan();
    plan = moveCargoCar(plan, "n1", "next");
    plan = moveCargoCar(plan, "a1", "after");
    const pins = irissHomeLogisticsPins(plan);
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
    expect(text).not.toContain("bez laika");
    expect(text).not.toContain("Bebra");
    expect(text).not.toMatch(/\bDE\b/);
    expect(text).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("tukšam plānam paliek bez virsraksta, bez Karte un bez vietas/laika rindas", () => {
    const pins = irissHomeLogisticsPins(emptyCargoPlan());
    const html = renderHtml(<IrissHomeLogisticsPins href="/admin/iriss/logistika" pins={pins} />);
    const text = renderText(<IrissHomeLogisticsPins href="/admin/iriss/logistika" pins={pins} />);
    expect(html).toContain('aria-label="Loģistika"');
    expect(html).not.toContain("Karte");
    expect(text).not.toContain("bez laika");
    expect(text).not.toContain("Bebra");
    expect(text).not.toMatch(/\bDE\b/);
  });
});
