import { describe, expect, it } from "vitest";
import { LOGISTICS_STEP_LV, LOGISTICS_STEPS, logisticsStepOf, logisticsStepWrite } from "@/lib/iriss-logistics-steps";

describe("Loģistika - 4 soļi 11 statusu vietā (Nils 27.10)", () => {
  it("soļi un nosaukumi", () => {
    expect(LOGISTICS_STEPS.map((s) => LOGISTICS_STEP_LV[s])).toEqual(["Gaida apmaksu/dokumentus", "Gatavs savākšanai", "Ceļā", "Atvests"]);
  });

  it("vecie statusi saplūst 4 soļos", () => {
    expect(logisticsStepOf("documents_issuing", null)).toBe("waiting");
    expect(logisticsStepOf("organize_pickup", "waiting")).toBe("waiting");
    expect(logisticsStepOf("pickup_confirmed", null)).toBe("ready");
    expect(logisticsStepOf("waiting_transport", null)).toBe("ready");
    expect(logisticsStepOf("picked_up", null)).toBe("in_transit");
    expect(logisticsStepOf("delivered", null)).toBe("arrived");
  });

  it("tālākais no statusa un pickup posma (soli neatceļ atpakaļ)", () => {
    expect(logisticsStepOf("awaiting_payment", "in_transit")).toBe("in_transit");
    expect(logisticsStepOf("in_transit_to_warehouse", "planned")).toBe("in_transit");
    expect(logisticsStepOf("ready_for_pickup", "arrived")).toBe("arrived");
  });

  it("izvēlētais solis ieraksta vienu statusu un pickup posmu", () => {
    expect(logisticsStepWrite("waiting")).toEqual({ status: "awaiting_payment", stage: "waiting" });
    expect(logisticsStepWrite("ready")).toEqual({ status: "ready_for_pickup", stage: "planned" });
    expect(logisticsStepWrite("in_transit")).toEqual({ status: "in_transit_to_warehouse", stage: "in_transit" });
  });
});
