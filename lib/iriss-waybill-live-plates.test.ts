/**
 * j25: P02816 (B193-7, PEUGEOT 5008, tradeAct) izdota 23.10 22:09 - poga rādīja "aizņemts", aplis "brīvs".
 * Apļi un numura pogas tagad lieto vienu stāvokli: indekss + CSDD + pieprasījumu rinda.
 */
import { describe, expect, it } from "vitest";
import { waybillGaugesFromPlates } from "@/lib/iriss-waybill-gauges";
import { withWaybillRequestStates } from "@/lib/iriss-waybill-live-plates";
import { WAYBILL_MOBILE_CURRENT_LIMIT, waybillMobileRequestRows } from "@/lib/iriss-waybill-mobile-form";
import { emptyWaybillPlateStates, waybillPlateOccupancy, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import { parseWaybillRequest, type WaybillRequest } from "@/lib/iriss-waybill-requests";

const ISSUED_AT = "2026-10-23T19:09:00.000Z"; // 22:09 Rīgā
const UNTIL = "2026-10-25T19:09:00.000Z"; // 25.10 21:09 Rīgā (pēc pārejas uz ziemas laiku)
const NOW = Date.parse("2026-10-23T20:09:00.000Z"); // 1 h pēc izdošanas

function req(over: Record<string, unknown>): WaybillRequest {
  const r = parseWaybillRequest({
    id: "wbr_x",
    createdBy: "env-admin",
    createdAt: "2026-10-23T10:00:00.000Z",
    updatedAt: "2026-10-23T10:05:00.000Z",
    vehicle: { brandModel: "BMW 330", plate: "B1937" },
    status: "issued",
    validUntil: "2026-10-23T12:00:00.000Z",
    ...over,
  });
  if (!r) throw new Error("fixture");
  return r;
}

const p02816 = req({
  id: "wbr_eaee6aff1170e09d",
  createdAt: "2026-10-23T19:08:00.000Z",
  updatedAt: ISSUED_AT,
  vehicle: { brandModel: "PEUGEOT 5008", vin: "VF30ARHHAAS201388", plate: "B193-7" },
  status: "issued",
  waybillNo: "P02816",
  validUntil: UNTIL,
  tradeAct: true,
  representative: "Nils Valainis",
});

/** Pārējie divi numuri no indeksa (kā ekrānuzņēmumā: B762-7 MB E250 41 h, B192-7 VW Touran 14 h). */
function indexPlates(): WaybillPlateState[] {
  const h = (n: number) => new Date(NOW + n * 3_600_000).toISOString();
  return waybillPlateOccupancy(
    [
      { plate: "B762-7", number: "P02810", brandModel: "MB E250", validUntil: h(41.5), issuedAt: h(-6) },
      { plate: "B192-7", number: "P02811", brandModel: "VW Touran", validUntil: h(14.5), issuedAt: h(-30) },
      // B193-7 indeksā tikai vecā, beigusies pavadzīme (P02816 vēl nav sinhronizēta no Dropbox).
      { plate: "B193-7", number: "P02812", brandModel: "BMW 216D", validUntil: "2026-10-23T18:00:00.000Z", issuedAt: "2026-10-22T18:00:00.000Z" },
    ],
    new Date(NOW),
  );
}

describe("j25 numuru stāvoklis apļiem un pogām", () => {
  it("izdota tradeAct pavadzīme, kuras vēl nav indeksā, padara numuru aizņemtu ar auto un atlikušajām stundām", () => {
    const plates = withWaybillRequestStates(indexPlates(), [p02816], NOW);
    const b193 = plates.find((p) => p.plate === "B193-7");
    expect(b193).toMatchObject({ busy: true, current: { number: "P02816", brandModel: "PEUGEOT 5008", validUntil: UNTIL } });

    const gauges = waybillGaugesFromPlates(plates, [], new Date(NOW));
    expect(gauges.map((g) => [g.plate, g.busy, g.brandModel, g.hoursLeft])).toEqual([
      ["B193-7", true, "PEUGEOT 5008", 47],
      ["B762-7", true, "MB E250", 41],
      ["B192-7", true, "VW Touran", 14],
    ]);
    // Aplis un poga vienmēr saskan: tas pats stāvoklis.
    expect(gauges.map((g) => g.busy)).toEqual(plates.map((p) => p.busy));
  });

  it("aplis rāda pavadzīmi neatkarīgi no Dzēst un 3 ierakstu saraksta (#540)", () => {
    const newer = [1, 2, 3, 4].map((i) =>
      req({
        id: `wbr_err${i}`,
        status: "error",
        createdAt: `2026-10-23T19:5${i}:00.000Z`,
        updatedAt: `2026-10-23T19:5${i}:30.000Z`,
        vehicle: { brandModel: `Auto ${i}`, plate: "B762-7" },
        errorReason: "Kļūda",
      }),
    );
    const requests = [...newer, p02816];
    const list = waybillMobileRequestRows(requests, [], WAYBILL_MOBILE_CURRENT_LIMIT, {
      nowMs: NOW,
      dismissed: ["wbr_eaee6aff1170e09d"],
    });
    // #540 saraksts derīgu izdotu nekad neslēpj (aktīvie pirmie) - tas nav cēlonis; aplis no saraksta nav atkarīgs.
    expect(list[0]?.id).toBe(p02816.id);

    const plates = withWaybillRequestStates(indexPlates(), requests, NOW);
    const g = waybillGaugesFromPlates(plates, [], new Date(NOW)).find((x) => x.plate === "B193-7");
    expect(g).toMatchObject({ busy: true, brandModel: "PEUGEOT 5008", hoursLeft: 47 });
  });

  it("kamēr CSDD izdod, aplis rāda 'izdod...' ar auto, bet numurs paliek brīvs", () => {
    const queued = req({
      id: "wbr_q",
      status: "in_progress",
      createdAt: "2026-10-23T20:08:00.000Z",
      updatedAt: "2026-10-23T20:08:30.000Z",
      pickedAt: "2026-10-23T20:08:30.000Z",
      vehicle: { brandModel: "PEUGEOT 5008", plate: "B1937" },
      validUntil: UNTIL,
      waybillNo: "",
    });
    const plates = withWaybillRequestStates(indexPlates(), [queued], NOW);
    const b193 = plates.find((p) => p.plate === "B193-7")!;
    expect(b193.busy).toBe(false);
    expect(b193.issuing).toEqual({ brandModel: "PEUGEOT 5008" });
    const g = waybillGaugesFromPlates(plates, [], new Date(NOW)).find((x) => x.plate === "B193-7");
    expect(g).toMatchObject({ busy: false, status: "issuing", brandModel: "PEUGEOT 5008" });
  });

  it("beigusies, aizstāta vai novecojusi pieprasījuma pavadzīme numuru neaizņem", () => {
    const ended = req({ id: "wbr_end", waybillNo: "P02800", validUntil: "2026-10-23T19:00:00.000Z" });
    const replaced = req({ id: "wbr_old", waybillNo: "P02801", validUntil: UNTIL, createdAt: "2026-10-22T10:00:00.000Z" });
    const replacer = req({
      id: "wbr_new",
      waybillNo: "P02802",
      createdAt: "2026-10-23T09:00:00.000Z",
      updatedAt: "2026-10-23T09:01:00.000Z",
      validUntil: "2026-10-23T12:00:00.000Z",
    });
    const staleQueued = req({ id: "wbr_stale", status: "queued", createdAt: "2026-10-21T10:00:00.000Z", updatedAt: "2026-10-21T10:00:00.000Z", validUntil: UNTIL });
    const plates = withWaybillRequestStates(emptyWaybillPlateStates(), [ended, replaced, replacer, staleQueued], NOW);
    expect(plates.find((p) => p.plate === "B193-7")).toEqual({ plate: "B193-7", busy: false });
  });

  it("indeksa / CSDD pavadzīme ar vēlāku termiņu netiek pārrakstīta; tā pati pavadzīme saņem auto nosaukumu", () => {
    const later = new Date(Date.parse(UNTIL) + 3_600_000).toISOString();
    const fromCsdd: WaybillPlateState[] = [
      { plate: "B193-7", busy: true, current: { number: "P02899", brandModel: "Manuāla", validUntil: later } },
      { plate: "B762-7", busy: true, current: { number: "P02816", brandModel: "", validUntil: UNTIL } },
      { plate: "B192-7", busy: false },
    ];
    const sameOnB762 = { ...p02816, vehicle: { ...p02816.vehicle, plate: "B762-7" } };
    const out = withWaybillRequestStates(fromCsdd, [p02816, sameOnB762], NOW);
    expect(out[0].current).toEqual({ number: "P02899", brandModel: "Manuāla", validUntil: later });
    expect(out[1].current).toEqual({ number: "P02816", brandModel: "PEUGEOT 5008", validUntil: UNTIL });
  });

  it("j31: tiklīdz pieprasīta jauna (manuāla) pavadzīme aizņemtam numuram, aplis rāda 'izdod...', nevis vecās atlikumu", () => {
    const replacement = req({
      id: "wbr_new",
      status: "queued",
      createdAt: "2026-10-23T20:08:00.000Z",
      updatedAt: "2026-10-23T20:08:00.000Z",
      vehicle: { brandModel: "VW Touran", plate: "B192-7" },
      plateBusyAtCreate: true,
      replaceWaybillNo: "P02811",
      validUntil: UNTIL,
      waybillNo: "",
    });
    const plates = withWaybillRequestStates(indexPlates(), [replacement], NOW);
    const b192 = plates.find((p) => p.plate === "B192-7")!;
    // Vecā (indeksa) pavadzīme joprojām tehniski derīga - "aizņemts" nemainās, kamēr jaunā nav izdota.
    expect(b192.busy).toBe(true);
    expect(b192.issuing).toEqual({ brandModel: "VW Touran" });
    const g = waybillGaugesFromPlates(plates, [], new Date(NOW)).find((x) => x.plate === "B192-7");
    // Bet aplis vairs nerāda veco P02811 atlikumu - rāda, ka tiek izdota jauna.
    expect(g).toMatchObject({ busy: false, status: "issuing", brandModel: "VW Touran" });
  });

  it("PDF saite apļa detaļām pēc pavadzīmes numura", () => {
    const plates = withWaybillRequestStates(indexPlates(), [p02816], NOW);
    const g = waybillGaugesFromPlates(plates, [{ id: "pv_1", plate: "B 193-7", number: "P02816", validUntil: UNTIL }], new Date(NOW));
    expect(g[0]).toMatchObject({ id: "pv_1", number: "P02816" });
  });
});
