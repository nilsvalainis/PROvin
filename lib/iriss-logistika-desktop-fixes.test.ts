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
    expect(map).toContain("logisticsPinCardCars(");
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

  it("accepts a dropped card anywhere in a section and always clears drag state", () => {
    expect(plan).toMatch(/<section[\s\S]*?onDragOver=[\s\S]*?onDrop=/);
    expect(plan).toContain('window.addEventListener("dragend", clear)');
    expect(plan).toContain('e.dataTransfer.setData("text/plain", car.carId)');
  });

  it("uses a real switch for 'Rādīt kartē'", () => {
    expect(plan).toContain('role="switch"');
    expect(plan).toContain("aria-checked={car.showOnMap}");
    expect(plan).not.toContain('type="checkbox"\n                          className="iriss-log-check"');
    const css = read("app/admin/iriss/logistika/iriss-logistika.css");
    expect(css).toContain(".iriss-log-screen .iriss-log-switch.sm.on {");
  });
});

describe("Loģistika layout", () => {
  const client = read("components/admin/iriss-logistika/IrissLogistikaClient.tsx");

  it("spreads the Visi auto table across both columns on desktop", () => {
    expect(client).toContain('<div className="min-w-0 lg:col-span-2 lg:row-start-2">');
    expect(client).toContain('className="space-y-3 lg:col-start-2 lg:row-start-1"');
  });

  it("row click bounces the pin briefly instead of keeping it pressed", () => {
    expect(client).toContain("onRowClick={pulseBounce}");
    expect(client).not.toContain("setBounceId((cur) => (cur === id ? null : id))");
  });

  it("keeps table button and cargo text on one line", () => {
    const table = read("components/admin/iriss-logistika/IrissLogistikaCarsTable.tsx");
    expect(table).toContain("iriss-log-btn-sec h-8 whitespace-nowrap");
    expect(table).toContain("inline-flex items-center gap-1.5 whitespace-nowrap");
  });
});
