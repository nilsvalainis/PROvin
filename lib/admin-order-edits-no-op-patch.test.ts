import { describe, expect, it } from "vitest";
import {
  orderEditsNeedServerPatch,
  orderEditsPersistKey,
  pickOrderEditsForHydration,
  serializeOrderEditsForLocalStorage,
} from "@/lib/admin-order-edits-persist";

/** FABLE v3: atverot PRO pasūtījumu tika sūtīts orderEdits PATCH ar nemainītiem laukiem. */
describe("orderEdits PATCH tikai, ja ir izmaiņas pret serveri", () => {
  const server = { orderEdits: { vin: "WVGZZZE2ZNP009103", customerName: "FABLE DEMO", notes: "x" } };

  it("atverot bez lokāla ieraksta - nekas nav jāsūta", () => {
    const picked = pickOrderEditsForHydration(server, null);
    expect(orderEditsNeedServerPatch(picked, orderEditsPersistKey(server.orderEdits))).toBe(false);
  });

  it("lokālais ieraksts = serveris (cita lauku secība) - nekas nav jāsūta", () => {
    const local = serializeOrderEditsForLocalStorage({ notes: "x", customerName: "FABLE DEMO", vin: "WVGZZZE2ZNP009103" });
    const picked = pickOrderEditsForHydration(server, local);
    expect(orderEditsNeedServerPatch(picked, orderEditsPersistKey(server.orderEdits))).toBe(false);
  });

  it("lokāli jaunāks teksts (nenosūtīts) - jāsūta", () => {
    const local = serializeOrderEditsForLocalStorage({ customerName: "FABLE DEMO 2" });
    const picked = pickOrderEditsForHydration(server, local);
    expect(orderEditsNeedServerPatch(picked, orderEditsPersistKey(server.orderEdits))).toBe(true);
  });

  it("jauns pasūtījums bez servera ieraksta: tukšs nav jāsūta, ar tekstu - jāsūta", () => {
    expect(orderEditsNeedServerPatch({}, orderEditsPersistKey(undefined))).toBe(false);
    expect(orderEditsNeedServerPatch({ vin: "W" }, orderEditsPersistKey(undefined))).toBe(true);
  });
});
