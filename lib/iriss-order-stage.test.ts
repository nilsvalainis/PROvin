import { describe, expect, it } from "vitest";
import {
  IRISS_ORDER_STAGE_LIST_STATUS,
  applyIrissOrderStage,
  attachIrissOrderStageSignals,
  irissListRowStageHint,
  irissOrderStage,
  irissOrderStageSignals,
} from "@/lib/iriss-order-stage";
import {
  IRISS_ORDER_STAGES,
  IRISS_ORDER_STAGE_SEARCH_LV,
  IRISS_PASUTIJUMS_LIST_STATUSES,
  emptyIrissPasutijums,
  isIrissPasutijumsSearchingStatus,
  isIrissPasutijumsWorkingStatus,
  type IrissOrderStageSignals,
} from "@/lib/iriss-pasutijumi-types";
import type { IrissPdListRow } from "@/lib/iriss-piedavajumi-types";

const NOW = Date.parse("2026-11-20T10:00:00Z");

function pd(p: Partial<IrissPdListRow>): IrissPdListRow {
  return {
    id: "pd1", number: 14, status: "sent", title: "BMW", vin: "", clientName: "", clientOrderId: "o1", source: "manual" as IrissPdListRow["source"],
    sourceRef: "", sourceKey: "", hasAuto1: false, price: "", validUntil: "", approvedOrderId: "", cover: null,
    updatedAt: "2026-11-18T10:00:00Z", openQuestions: 0, ...p,
  };
}

describe("irissOrderStage (lasot, pirmā atbilstošā)", () => {
  it("vecie lauki", () => {
    expect(irissOrderStage({ listStatus: "active" })).toBe("searching");
    expect(irissOrderStage({ listStatus: "searching" })).toBe("searching");
    expect(irissOrderStage({ listStatus: "offered" })).toBe("offered");
    expect(irissOrderStage({ listStatus: "active", dealWorkflowStatus: "piedavats" })).toBe("offered");
    expect(irissOrderStage({ listStatus: "reserved" })).toBe("reserved");
    expect(irissOrderStage({ listStatus: "active", dealWorkflowStatus: "avanss_sanemts" })).toBe("reserved");
    expect(irissOrderStage({ listStatus: "reserved", dealWorkflowStatus: "nopirkts" })).toBe("transit");
    expect(irissOrderStage({ listStatus: "active", dealWorkflowStatus: "transporta" })).toBe("transit");
    expect(irissOrderStage({ listStatus: "completed" })).toBe("sold");
    expect(irissOrderStage({ listStatus: "reserved", dealWorkflowStatus: "nodots" })).toBe("sold");
    expect(irissOrderStage({ listStatus: "inactive" })).toBe("inactive");
    expect(irissOrderStage({ listStatus: "reserved", dealWorkflowStatus: "atcelts" })).toBe("inactive");
  });

  it("PD «Nosūtīts» -> Piedāvāts; noraidīts/beidzies -> atpakaļ Meklējam (3A)", () => {
    const sent = irissOrderStageSignals({ id: "o1" }, [pd({})], [], NOW);
    expect(irissOrderStage({ listStatus: "active" }, sent)).toBe("offered");
    expect(sent.pdSent?.label).toBe("PD-0014");
    for (const status of ["declined", "cancelled"] as const) {
      const s = irissOrderStageSignals({ id: "o1" }, [pd({ status })], [], NOW);
      expect(irissOrderStage({ listStatus: "active" }, s)).toBe("searching");
    }
    const expired = irissOrderStageSignals({ id: "o1" }, [pd({ validUntil: "2026-11-01" })], [], NOW);
    expect(irissOrderStage({ listStatus: "active" }, expired)).toBe("searching");
    const other = irissOrderStageSignals({ id: "o2" }, [pd({})], [], NOW);
    expect(irissOrderStage({ listStatus: "active" }, other)).toBe("searching");
  });

  it("Autoparka auto: Ceļā tikai rezervētam; Pārdots", () => {
    const rows = [pd({ status: "approved", approvedOrderId: "o1", sourceRef: "autoparks:c1" })];
    const transit = irissOrderStageSignals({ id: "o1" }, rows, [{ id: "c1", vin: "", status: "in_transit" }], NOW);
    expect(irissOrderStage({ listStatus: "reserved" }, transit)).toBe("transit");
    expect(irissOrderStage({ listStatus: "active" }, transit)).toBe("searching");
    const stock = irissOrderStageSignals({ id: "o1" }, rows, [{ id: "c1", vin: "", status: "prep_waiting" }], NOW);
    expect(irissOrderStage({ listStatus: "reserved" }, stock)).toBe("transit");
    const forSale = irissOrderStageSignals({ id: "o1" }, rows, [{ id: "c1", vin: "", status: "reserved" }], NOW);
    expect(irissOrderStage({ listStatus: "reserved" }, forSale)).toBe("reserved");
    const sold = irissOrderStageSignals({ id: "o1" }, rows, [{ id: "c1", vin: "", status: "sold" }], NOW);
    expect(irissOrderStage({ listStatus: "reserved" }, sold)).toBe("sold");
    expect(irissOrderStage({ listStatus: "inactive" }, sold)).toBe("inactive");
    const byVin = irissOrderStageSignals({ id: "o9", vin: "WBA5R1C0XLFH42873" }, [], [{ id: "c2", vin: "wba5r1c0xlfh42873", status: "in_service" }], NOW);
    expect(irissOrderStage({ listStatus: "reserved" }, byVin)).toBe("transit");
    expect(byVin.car?.label).toBe("Autoparks: Servisā");
  });

  it("attach: rindas bez signāliem paliek tās pašas", () => {
    const rows: Array<{ id: string; stageSignals?: IrissOrderStageSignals }> = [{ id: "o1" }, { id: "o2" }];
    const out = attachIrissOrderStageSignals(rows, [pd({})], [], NOW);
    expect(out[0]!.stageSignals?.pdSent).toBeTruthy();
    expect(out[1]).toBe(rows[1]);
  });
});

describe("applyIrissOrderStage (ar roku)", () => {
  const base = { ...emptyIrissPasutijums("o1", "2026-11-01T00:00:00Z"), dealWorkflowStatus: "piedavats" };
  const at = "2026-11-20T10:00:00.000Z";

  it("katrs posms pēc maiņas aprēķinās atpakaļ tas pats", () => {
    for (const stage of ["searching", "offered", "reserved", "transit", "sold", "inactive"] as const) {
      for (const deal of ["jauns", "piedavats", "avanss_sanemts", "nopirkts", "nodots", "atcelts"]) {
        const next = applyIrissOrderStage({ ...base, dealWorkflowStatus: deal }, stage, { at });
        expect(irissOrderStage(next), `${deal} -> ${stage}`).toBe(stage);
      }
    }
  });

  it("vēsture ar posmu, arī ja listStatus nemainās (Rezervēts -> Ceļā)", () => {
    const r = applyIrissOrderStage(base, "reserved", { at });
    const t = applyIrissOrderStage(r, "transit", { at });
    expect(t.listStatus).toBe("reserved");
    expect(t.statusHistory?.at(-1)).toMatchObject({ from: "reserved", to: "reserved", stage: "transit" });
    expect(t.statusChangedAt).toBe(at);
  });

  it("avanss saglabājas Rezervēts posmā; neaktīvs ar iemeslu", () => {
    const r = applyIrissOrderStage({ ...base, dealWorkflowStatus: "avanss_sanemts" }, "reserved", { at });
    expect(r.dealWorkflowStatus).toBe("avanss_sanemts");
    const n = applyIrissOrderStage(base, "inactive", { at, reason: "Nopirka citur" });
    expect(n.inactiveReason).toBe("Nopirka citur");
    expect(n.statusHistory?.at(-1)?.reason).toBe("Nopirka citur");
  });
});

describe("irissListRowStageHint", () => {
  it("piezīmes", () => {
    expect(irissListRowStageHint({ listStatus: "reserved", advancePaidAt: "2026-11-19" })).toBe("Avanss ✓ 19.11");
    expect(irissListRowStageHint({ listStatus: "active", stageSignals: { pdSent: { label: "PD-0017", at: "2026-11-19T08:00:00Z" } } })).toBe(
      "PD-0017 nosūtīts 19.11",
    );
    expect(irissListRowStageHint({ listStatus: "active" })).toBe("");
  });
});

describe("meklēšanas statusi (Nils 24.11: Rezervēts aptur meklēšanu)", () => {
  it("meklē tikai aktīvs / meklē / piedāvāts; «working» paliek ar rezervētu", () => {
    const searching = IRISS_PASUTIJUMS_LIST_STATUSES.filter(isIrissPasutijumsSearchingStatus);
    expect(searching).toEqual(["active", "searching", "offered"]);
    expect(IRISS_PASUTIJUMS_LIST_STATUSES.filter(isIrissPasutijumsWorkingStatus)).toEqual(["active", "searching", "offered", "reserved"]);
  });

  it("izvēlnes norāde sakrīt ar to, ko posms saglabā", () => {
    for (const stage of IRISS_ORDER_STAGES) {
      const searches = isIrissPasutijumsSearchingStatus(IRISS_ORDER_STAGE_LIST_STATUS[stage]);
      expect(`${stage}:${IRISS_ORDER_STAGE_SEARCH_LV[stage]}`).toBe(`${stage}:${searches ? "meklē" : "nemeklē"}`);
    }
    expect(IRISS_ORDER_STAGE_SEARCH_LV.reserved).toBe("nemeklē");
  });
});
