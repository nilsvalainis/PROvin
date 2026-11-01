import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { logisticsMapFitKey, logisticsPinCardCars } from "@/lib/iriss-logistics-labels";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("Loģistika map pin card", () => {
  it("lists every car (make and model) instead of 'N auto', max 3 + '+N'", () => {
    expect(logisticsPinCardCars([{ make: "Volvo", model: "XC60" }, { make: "BMW", model: "iX" }])).toEqual({
      cars: [
        { make: "Volvo", model: "XC60" },
        { make: "BMW", model: "iX" },
      ],
      more: 0,
    });
    const many = logisticsPinCardCars([
      { make: "A", model: "1" },
      { make: "B", model: "2" },
      { make: "C", model: "3" },
      { make: "D", model: "4" },
      { make: "E", model: "5" },
    ]);
    expect(many.cars).toHaveLength(3);
    expect(many.more).toBe(2);
    expect(logisticsPinCardCars([{ make: " ", model: "" }]).cars[0]).toEqual({ make: "Auto", model: "" });
  });

  it("does not show the auction name or 'N auto' on the card", () => {
    const map = read("components/admin/iriss-logistika/IrissLogistikaMap.tsx");
    expect(map).not.toContain("`${count} auto`");
    expect(map).not.toContain("head.statusLv || head.auction");
    // Pastāvīgas kartītes vairs nav: punkts + grupa, nosaukums tikai hover/izceltam.
    expect(map).not.toContain("iriss-log-pin-card");
    expect(map).toContain("layoutMapPins(placed, input.showLabels ? 14 : 30)");
    // Google stila lāses; grupa "N auto", nevis skaitlis, ko var sajaukt ar pieturas numuru.
    expect(map).toContain("teardropSvg(");
    expect(map).toContain("auto</span>");
    expect(map).toContain("pinLabelHtml(");
    expect(map).toContain("iriss-log-pin-tip");
  });
});

describe("Loģistika map keeps the user's view", () => {
  it("fit key ignores order and changes only with the point set", () => {
    expect(logisticsMapFitKey("cars", ["b", "a"])).toBe(logisticsMapFitKey("cars", ["a", "b"]));
    expect(logisticsMapFitKey("cars", ["a"])).not.toBe(logisticsMapFitKey("cars", ["a", "b"]));
    expect(logisticsMapFitKey("cars", ["a"])).not.toBe(logisticsMapFitKey("previous", ["a"]));
  });

  it("only fits bounds when the point set or focus changes, not on hover", () => {
    const map = read("components/admin/iriss-logistika/IrissLogistikaMap.tsx");
    expect(map).toContain("if (!lockView && (fitChanged || (focusChanged && focus)))");
    expect(map).toContain("lastFitKeyRef");
  });
});

describe("Kravu plāns", () => {
  const plan = read("components/admin/iriss-logistika/IrissLogistikaCargoPlan.tsx");

  it("drags the whole card with mouse and touch, drops at an exact position", () => {
    expect(plan).toContain("useSensor(MouseSensor, { activationConstraint: { distance: 5 } })");
    expect(plan).toContain("useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })");
    // Nils 02.11: nomešana iet caur change() ar «Atsaukt».
    expect(plan).toContain("change(moveCargoCar(plan, activeId, bucket, index)");
    expect(plan).toContain("onDragCancel={() => finishDrag(null)}");
    expect(plan).toMatch(/className=\{`iriss-log-cargo-row[^`]*`\}\s*\{\.\.\.attributes\}\s*\{\.\.\.listeners\}/);
  });

  it("uses a real switch for 'Rādīt kartē'", () => {
    expect(plan).toContain('role="switch"');
    expect(plan).toContain("aria-checked={showOnMap}");
    expect(plan).not.toContain('type="checkbox"\n                          className="iriss-log-check"');
    const css = read("app/admin/iriss/logistika/iriss-logistika.css");
    expect(css).toContain(".iriss-log-screen .iriss-log-switch.sm.on {");
  });
});

describe("Loģistika layout", () => {
  const client = read("components/admin/iriss-logistika/IrissLogistikaClient.tsx");

  it("has one car list: the cargo plan (Visi auto table removed, makets 26.10)", () => {
    expect(client).not.toContain("<IrissLogistikaCarsTable");
    expect(client).toContain("stageLabelByCarId={stageLabelByCarId}");
    expect(client).toContain('className="iriss-log-cargo-col space-y-3 lg:col-start-2 lg:row-start-1"');
  });

  it("row click bounces the pin briefly instead of keeping it pressed", () => {
    expect(client).toContain("onRowClick={pulseBounce}");
    expect(client).not.toContain("setBounceId((cur) => (cur === id ? null : id))");
  });

  it("keeps table button and cargo text on one line", () => {
    const table = read("components/admin/iriss-logistika/IrissLogistikaCarsTable.tsx");
    expect(table).toContain("h-8 min-h-8 whitespace-nowrap px-2.5 text-[12px]");
    expect(table).toContain('<table className="iriss-log-table max-xl:hidden">');
    expect(table).toContain('<ul className="iriss-log-car-cards xl:hidden">');
  });
});
