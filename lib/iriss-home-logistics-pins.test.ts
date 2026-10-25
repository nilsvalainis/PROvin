import { describe, expect, it } from "vitest";
import { emptyCargoPlan, moveCargoCar } from "@/lib/iriss-logistics-cargo-plan";
import { homePinPlace, homePinTime, irissHomeLogisticsPins } from "@/lib/iriss-home-logistics-pins";

const order = (id: string, city: string, pickupDate: string, address = "") => ({
  id,
  pickupDate,
  pickupAddress: address,
  pickupSnapshot: city ? { city } : null,
});

describe("homePinTime / homePinPlace", () => {
  it("ņem HH:MM tikai no īsta laika, pilsētu no snapshot vai adreses beigām", () => {
    expect(homePinTime("2026-10-25T14:30:00.000Z")).toBe("14:30");
    expect(homePinTime("2026-10-25")).toBe("");
    expect(homePinTime("2026-10-25T00:00:00.000Z")).toBe("");
    expect(homePinPlace(order("a", "Rīga", ""), "")).toBe("Rīga");
    expect(homePinPlace(order("a", "", "", "Iela 1, Jelgava"), "X")).toBe("Jelgava");
    expect(homePinPlace(undefined, "Rīga")).toBe("Rīga");
  });
});

describe("irissHomeLogisticsPins", () => {
  it("rāda trīs pin-us: Nākošā, Aiznākošā, Gaida, bez izdomātiem laikiem", () => {
    let plan = emptyCargoPlan();
    plan = moveCargoCar(plan, "n1", "next");
    plan = moveCargoCar(plan, "n2", "next");
    plan = moveCargoCar(plan, "a1", "after");
    plan = moveCargoCar(plan, "w1", "none");
    plan = {
      ...plan,
      routes: {
        ...plan.routes,
        next: { ...plan.routes.next, start: { label: "Rīga", address: "", lat: 1, lng: 1, type: "other", templateId: "" } },
      },
    };
    const pins = irissHomeLogisticsPins(plan, [
      order("n1", "Rīga", "2026-10-25T14:30:00.000Z"),
      order("a1", "Jelgava", "2026-10-25T16:10:00.000Z"),
      order("w1", "", ""),
    ]);
    expect(pins.map((p) => p.label)).toEqual(["Nākošā", "Aiznākošā", "Gaida"]);
    expect(pins[0]).toMatchObject({ count: 2, tone: "ok", detail: "14:30 · Rīga" });
    expect(pins[1]).toMatchObject({ count: 1, tone: "soon", detail: "16:10 · Jelgava" });
    expect(pins[2]).toMatchObject({ count: 1, tone: "wait", detail: "bez laika" });
  });

  it("tukšam plānam paliek 0 un bez laika", () => {
    const pins = irissHomeLogisticsPins(emptyCargoPlan(), []);
    expect(pins.every((p) => p.count === 0 && p.detail === "bez laika")).toBe(true);
  });
});
