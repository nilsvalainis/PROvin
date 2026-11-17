import { describe, expect, it } from "vitest";
import { waybillHomeCarText, waybillHomeCarTitle, waybillGaugeTimeLeft } from "@/lib/iriss-waybill-gauges";

describe("waybillHomeCarText / waybillHomeCarTitle", () => {
  it("rāda pilnu marku/modeli, bez pirmo 2 vārdu nogriešanas", () => {
    const g = { busy: true, status: "ok" as const, brandModel: "MERCEDES-BENZ E 220 D All-Terrain" };
    expect(waybillHomeCarText(g)).toBe("MERCEDES-BENZ E 220 D All-Terrain");
    expect(waybillHomeCarTitle(g)).toBe("MERCEDES-BENZ E 220 D All-Terrain");
    expect(waybillHomeCarText(g).split(/\s+/).length).toBeGreaterThan(2);
  });

  it("aizņemtam bez modeļa rāda auto, bez title", () => {
    const g = { busy: true, status: "ok" as const, brandModel: "  " };
    expect(waybillHomeCarText(g)).toBe("auto");
    expect(waybillHomeCarTitle(g)).toBeUndefined();
  });

  it("izdodējam rāda modeli vai svītru", () => {
    expect(waybillHomeCarText({ busy: false, status: "issuing", brandModel: "BMW 216D GRAN TOURER" })).toBe(
      "BMW 216D GRAN TOURER",
    );
    expect(waybillHomeCarTitle({ brandModel: "BMW 216D GRAN TOURER" })).toBe("BMW 216D GRAN TOURER");
    expect(waybillHomeCarText({ busy: false, status: "issuing", brandModel: "" })).toBe("-");
  });

  it("brīvam paliek svītra bez title", () => {
    expect(waybillHomeCarText({ busy: false, status: "free", brandModel: "" })).toBe("-");
    expect(waybillHomeCarTitle({ brandModel: "" })).toBeUndefined();
  });
});

describe("aplis < 1 h", () => {
  it("rāda minūtes, nevis 0h", () => {
    expect(waybillGaugeTimeLeft({ hoursLeft: 0, minutesLeft: 17 })).toEqual({ value: 17, unit: "min" });
    expect(waybillGaugeTimeLeft({ hoursLeft: 38, minutesLeft: 2290 })).toEqual({ value: 38, unit: "h" });
  });
});
