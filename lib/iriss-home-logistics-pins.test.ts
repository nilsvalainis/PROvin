import { describe, expect, it } from "vitest";
import { emptyCargoPlan, moveCargoCar } from "@/lib/iriss-logistics-cargo-plan";
import { irissHomeLogisticsPins } from "@/lib/iriss-home-logistics-pins";

describe("irissHomeLogisticsPins", () => {
  it("rāda trīs pin-us ar skaitu, bez vietas vai laika", () => {
    let plan = emptyCargoPlan();
    plan = moveCargoCar(plan, "n1", "next");
    plan = moveCargoCar(plan, "n2", "next");
    plan = moveCargoCar(plan, "a1", "after");
    plan = moveCargoCar(plan, "w1", "none");
    const pins = irissHomeLogisticsPins(plan);
    expect(pins.map((p) => p.label)).toEqual(["Nākošā", "Aiznākošā", "Gaida"]);
    expect(pins[0]).toEqual({ id: "next", label: "Nākošā", count: 2, tone: "ok" });
    expect(pins[1]).toEqual({ id: "after", label: "Aiznākošā", count: 1, tone: "soon" });
    expect(pins[2]).toEqual({ id: "wait", label: "Gaida", count: 1, tone: "wait" });
    expect(JSON.stringify(pins)).not.toMatch(/bez laika|Bebra|\bDE\b/);
  });

  it("tukšam plānam paliek 0, bez sekundārās rindas", () => {
    const pins = irissHomeLogisticsPins(emptyCargoPlan());
    expect(pins.every((p) => p.count === 0)).toBe(true);
    expect(pins.every((p) => !("detail" in p))).toBe(true);
  });
});
