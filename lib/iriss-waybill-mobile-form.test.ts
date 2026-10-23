import { describe, expect, it } from "vitest";
import {
  buildWaybillMobilePayload,
  firstFreeWaybillPlate,
  initialWaybillMobileForm,
  waybillMobileHours,
  waybillMobilePlate,
  waybillMobileProgress,
  waybillMobileRequestIsCurrent,
  waybillMobileRequestRows,
} from "@/lib/iriss-waybill-mobile-form";
import { parseCreateWaybillInput } from "@/lib/iriss-waybill-create";
import type { WaybillAivarsReply, WaybillRequest } from "@/lib/iriss-waybill-requests";

const base = initialWaybillMobileForm("B192-7");

describe("phone waybill form", () => {
  it("defaults to 48 h and start Tukums, preset and own hours work", () => {
    expect(base.hoursPreset).toBe(48);
    expect(base.from).toBe("tukums");
    expect(waybillMobileHours({ hoursPreset: 12, hoursOther: "" })).toBe(12);
    expect(waybillMobileHours({ hoursPreset: null, hoursOther: "72" })).toBe(72);
    expect(waybillMobileHours({ hoursPreset: null, hoursOther: "0" })).toBeNull();
    expect(waybillMobileHours({ hoursPreset: null, hoursOther: "2161" })).toBeNull();
    expect(waybillMobileHours({ hoursPreset: null, hoursOther: "" })).toBeNull();
  });

  it("comment only '193 uz BMW 330' sends plate 193 for 48 h, and the server accepts it", () => {
    const state = { ...base, comment: "193 uz BMW 330" };
    expect(waybillMobilePlate(state)).toBe("B193-7");
    const built = buildWaybillMobilePayload(state);
    expect(built).toEqual({
      ok: true,
      payload: {
        plate: "B193-7",
        brandModel: "",
        vin: "",
        validHours: 48,
        comment_untrusted: "193 uz BMW 330",
        routeFromAddress: "",
        tradeAct: false,
        representative: "",
      },
    });
    if (!built.ok) return;
    const server = parseCreateWaybillInput(built.payload, new Date("2026-10-22T18:00:00.000Z"));
    expect(server.ok && server.value.brandModel).toBe("BMW 330");
    expect(server.ok && server.value.validUntil).toBe("2026-10-24T18:00:00.000Z");
  });

  it("a tapped plate wins over the comment; a car from the list sends make, model and VIN", () => {
    const state = {
      ...base,
      plate: "B762-7",
      plateTouched: true,
      comment: "193 uz BMW 330",
      car: { id: "c1", brandModel: "Audi A6 Avant", vin: "WAUZZZF27LN004512" },
    };
    const built = buildWaybillMobilePayload(state);
    expect(built.ok && built.payload.plate).toBe("B762-7");
    expect(built.ok && built.payload.brandModel).toBe("Audi A6 Avant");
    expect(built.ok && built.payload.vin).toBe("WAUZZZF27LN004512");
  });

  it("manual car sends only make and model (no VIN field)", () => {
    const built = buildWaybillMobilePayload({ ...base, manual: true, manualBrandModel: " Opel Astra ", car: null });
    expect(built.ok && built.payload.brandModel).toBe("Opel Astra");
    expect(built.ok && built.payload.vin).toBe("");
  });

  it("other car: only a start address (Tukums by default or own); no destination", () => {
    const car = { id: "c1", brandModel: "VW Passat B8", vin: "" };
    expect(buildWaybillMobilePayload({ ...base, car, from: "other", fromAddress: " " })).toEqual({
      ok: false,
      error: "Ieraksti sākuma adresi.",
    });
    const own = buildWaybillMobilePayload({ ...base, car, from: "other", fromAddress: "Rīga, Brīvības 275" });
    expect(own.ok && own.payload).toMatchObject({ routeFromAddress: "Rīga, Brīvības 275", tradeAct: false });
    // "Cita adrese" paliek ievadītajā laukā, bet netiek sūtīta, ja izvēlēts Tukums.
    const back = buildWaybillMobilePayload({ ...base, car, from: "tukums", fromAddress: "Rīga" });
    expect(back.ok && back.payload.routeFromAddress).toBe("");
    if (!back.ok) return;
    const server = parseCreateWaybillInput(back.payload);
    expect(server.ok && [server.value.routeFrom, server.value.routeTo]).toEqual(["Tukums, Rīgas iela", "Tukuma CSDD"]);
  });

  it("accepted car: only time + komersanta pārstāvis, no route; server keeps route empty", () => {
    const car = { id: "c9", brandModel: "Škoda Kodiaq", vin: "TMBJJ7NS1L8012345", accepted: true };
    const built = buildWaybillMobilePayload({ ...base, car, from: "other", fromAddress: "Rīga", hoursPreset: 24 });
    expect(built).toEqual({
      ok: true,
      payload: {
        plate: "B192-7",
        brandModel: "Škoda Kodiaq",
        vin: "TMBJJ7NS1L8012345",
        validHours: 24,
        comment_untrusted: "",
        routeFromAddress: "",
        tradeAct: true,
        representative: "Taivo Batiņš",
      },
    });
    const iriss = buildWaybillMobilePayload({ ...base, plate: "B193-7", plateTouched: true, car });
    expect(iriss.ok && iriss.payload.representative).toBe("Nils Valainis");
    const picked = buildWaybillMobilePayload({ ...base, car, representative: "Cits Pārstāvis" });
    expect(picked.ok && picked.payload.representative).toBe("Cits Pārstāvis");
    if (!built.ok) return;
    const server = parseCreateWaybillInput(built.payload);
    expect(server.ok && server.value).toMatchObject({ tradeAct: true, routeFrom: "", routeTo: "", representative: "Taivo Batiņš" });
    // Ar roku ierakstīts auto nekad nav "pieņemts".
    const manual = buildWaybillMobilePayload({ ...base, car, manual: true, manualBrandModel: "Škoda Kodiaq" });
    expect(manual.ok && manual.payload.tradeAct).toBe(false);
  });

  it("asks for a car or a comment, and for a car in a free comment", () => {
    expect(buildWaybillMobilePayload(base)).toEqual({ ok: false, error: "Izvēlies auto vai uzraksti komentāru." });
    const free = buildWaybillMobilePayload({ ...base, comment: "lūdzu ātri" });
    expect(free.ok).toBe(false);
    expect(buildWaybillMobilePayload({ ...base, comment: "193 uz BMW", hoursPreset: null, hoursOther: "" }).ok).toBe(false);
  });

  it("picks the first free plate", () => {
    expect(
      firstFreeWaybillPlate(
        [
          { plate: "B193-7", busy: true },
          { plate: "B762-7", busy: false },
          { plate: "B192-7", busy: false },
        ],
        "B193-7",
      ),
    ).toBe("B762-7");
    expect(firstFreeWaybillPlate([{ plate: "B193-7", busy: true }], "B193-7")).toBe("B193-7");
  });
});

function req(over: Partial<WaybillRequest>): WaybillRequest {
  return {
    id: "wbr_a",
    createdBy: "u",
    createdByName: "",
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:00:00.000Z",
    vehicle: { brandModel: "BMW 216d", vin: "", plate: "B1937", orderId: "" },
    routeFrom: "",
    routeTo: "",
    validDays: 2,
    validHours: 48,
    validFrom: "",
    validUntil: "",
    noteUntrusted: "",
    status: "queued",
    waybillNo: "",
    pdfUrl: "",
    errorReason: "",
    lastReplyText: "",
    attempts: 1,
    pickedBy: "",
    pickedAt: "",
    plateBusyAtCreate: false,
    autoDisabled: false,
    tradeAct: false,
    representative: "",
    ...over,
  };
}

describe("phone list of Aivars requests", () => {
  it("shows newest first with status, PDF and retry", () => {
    const requests = [
      req({ id: "wbr_old", status: "issued", waybillNo: "26A118204" }),
      req({ id: "wbr_new", createdAt: "2026-10-22T11:00:00.000Z", status: "error", errorReason: "CSDD nav pieejams", vehicle: { brandModel: "", vin: "", plate: "B7627", orderId: "" }, noteUntrusted: "762 uz Audi" }),
    ];
    const replies: WaybillAivarsReply[] = [
      { requestId: "wbr_old", status: "issued", statusLabel: "Izveidota", text: "", waybillNo: "26A118204", pdfUrl: "/x.pdf", at: "" },
    ];
    const rows = waybillMobileRequestRows(requests, replies, 5, { nowMs: Date.parse("2026-10-22T12:00:00.000Z"), which: "all" });
    expect(rows.map((r) => r.id)).toEqual(["wbr_new", "wbr_old"]);
    expect(rows[0]).toMatchObject({ title: "762 uz Audi", label: "Kļūda", tone: "bad", canRetry: true, errorText: "CSDD nav pieejams" });
    expect(rows[0]?.sub).toContain("B762-7 · 48 h");
    expect(rows[1]).toMatchObject({ title: "BMW 216d", label: "Izrakstīta", tone: "ok", pdfUrl: "/x.pdf", canRetry: false });
    expect(rows[1]?.sub.startsWith("26A118204 · B193-7 · 48 h")).toBe(true);
  });

  it("queue item older than 24 h without progress is stale: archive only, marked Novecojis, data untouched", () => {
    const old = req({ id: "wbr_kodiaq", vehicle: { brandModel: "Škoda Kodiaq", vin: "", plate: "B1927", orderId: "" } });
    const frozen = JSON.stringify(old);
    const later = Date.parse("2026-10-23T10:00:01.000Z");
    expect(waybillMobileRequestIsCurrent(old, later)).toBe(false);
    expect(waybillMobileRequestRows([old], [], 5, { nowMs: later })).toEqual([]);
    const [row] = waybillMobileRequestRows([old], [], 5, { nowMs: later, which: "archive" });
    expect(row).toMatchObject({ id: "wbr_kodiaq", label: "Novecojis", stale: true, canRetry: true });
    expect(JSON.stringify(old)).toBe(frozen);
    // 23 h vēl ir tagadējs.
    expect(waybillMobileRequestIsCurrent(old, Date.parse("2026-10-23T09:00:00.000Z"))).toBe(true);
  });

  it("expired issued waybill and old errors leave the first page", () => {
    const now = Date.parse("2026-10-23T12:00:00.000Z");
    const valid = req({ status: "issued", validUntil: "2026-10-24T10:00:00.000Z" });
    const expired = req({ status: "issued", validUntil: "2026-10-23T11:00:00.000Z" });
    const oldError = req({ status: "error", updatedAt: "2026-10-22T10:00:00.000Z" });
    const freshError = req({ status: "error", updatedAt: "2026-10-23T11:00:00.000Z" });
    expect([valid, expired, oldError, freshError].map((r) => waybillMobileRequestIsCurrent(r, now))).toEqual([true, false, false, true]);
  });
});

describe("live progress", () => {
  const t0 = "2026-10-23T10:00:00.000Z";
  const at = (min: number) => Date.parse(t0) + min * 60_000;
  it("moves through 3 steps with a growing percentage", () => {
    const queued = waybillMobileProgress(req({ createdAt: t0, updatedAt: t0 }), at(1));
    expect(queued).toMatchObject({ step: 1, text: "Rindā. Aivars sāks pēc brīža." });
    const slow = waybillMobileProgress(req({ createdAt: t0, updatedAt: t0 }), at(16));
    expect(slow.step).toBe(1);
    expect(slow.text).toContain("Gaida ilgāk nekā parasti");
    const startWork = waybillMobileProgress(req({ status: "in_progress", pickedAt: t0, updatedAt: t0 }), at(0));
    const midWork = waybillMobileProgress(req({ status: "in_progress", pickedAt: t0, updatedAt: t0 }), at(2));
    expect(startWork.step).toBe(2);
    expect(midWork.pct).toBeGreaterThan(startWork.pct);
    expect(waybillMobileProgress(req({ status: "in_progress", pickedAt: t0 }), at(60)).pct).toBeLessThan(100);
    const done = waybillMobileProgress(req({ status: "issued", waybillNo: "26A1", validUntil: "2026-10-25T10:00:00.000Z" }), at(3));
    expect(done).toEqual({ step: 3, pct: 100, text: "Nr. 26A1 · derīga līdz 25.10.2026, 12:00" });
  });

  it("error after save asks to check CSDD before retry", () => {
    const err = waybillMobileProgress(req({ status: "error", pickedAt: t0, errorReason: "Automātika: x. Pārbaudi CSDD, vai pavadzīme izveidota." }));
    expect(err.text).toBe("Iespējams, pavadzīme CSDD jau ir izveidota. Pārbaudi, pirms atkārto.");
    expect(waybillMobileProgress(req({ status: "error", errorReason: "CSDD nav pieejams." })).text).toBe('Neizdevās: CSDD nav pieejams. Spied "Atkārtot".');
  });
});
