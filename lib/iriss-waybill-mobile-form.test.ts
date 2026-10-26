import { describe, expect, it } from "vitest";
import {
  WAYBILL_FORM_DEFAULT_HOURS,
  WAYBILL_MOBILE_HOUR_PRESETS,
  applyWaybillAutoChoice,
  buildWaybillMobilePayload,
  parseWaybillCustomHours,
  waybillAutoEntryValues,
  waybillWrittenOffAtMs,
  firstFreeWaybillPlate,
  initialWaybillMobileForm,
  waybillMobileHours,
  waybillMobilePlate,
  waybillMobileProgress,
  waybillMobileRequestIsCurrent,
  waybillMobileRequestRows,
  waybillShowsManualFields,
  waybillShowsTradeList,
} from "@/lib/iriss-waybill-mobile-form";
import { parseCreateWaybillInput, waybillRepresentativeChoices } from "@/lib/iriss-waybill-create";
import type { WaybillAivarsReply, WaybillRequest } from "@/lib/iriss-waybill-requests";
import type { WaybillPlateState } from "@/lib/iriss-waybill-plates";

const base = initialWaybillMobileForm("B192-7");

describe("phone waybill form", () => {
  it("hour choices are exactly 1 h, 12 h, 48 h + Cits (1-48, CSDD max), default 12 h", () => {
    expect([...WAYBILL_MOBILE_HOUR_PRESETS]).toEqual([1, 12, 48]);
    expect(WAYBILL_FORM_DEFAULT_HOURS).toBe(12);
    expect(base.hoursPreset).toBe(12);
    for (const h of WAYBILL_MOBILE_HOUR_PRESETS) expect(waybillMobileHours({ hoursPreset: h, hoursOther: "" })).toBe(h);
    expect(parseWaybillCustomHours("1")).toBe(1);
    expect(parseWaybillCustomHours("36")).toBe(36);
    expect(parseWaybillCustomHours(" 48 ")).toBe(48);
    for (const bad of ["0", "49", "", "1.5", "-3", "12h", "99999"]) expect(parseWaybillCustomHours(bad)).toBeNull();
    // Katru izvēli serveris pieņem; robežas 0 un 49 forma neļauj nosūtīt.
    const now = new Date("2026-10-23T10:00:00.000Z");
    for (const [hoursPreset, hoursOther] of [[1, ""], [12, ""], [48, ""], [null, "36"], [null, "48"]] as const) {
      const built = buildWaybillMobilePayload({ ...base, hoursPreset, hoursOther, comment: "192 uz VW Golf" });
      expect(built.ok).toBe(true);
      if (built.ok) expect(parseCreateWaybillInput(built.payload, now).ok).toBe(true);
    }
    for (const hoursOther of ["0", "49"]) {
      const built = buildWaybillMobilePayload({ ...base, hoursPreset: null, hoursOther, comment: "192 uz VW Golf" });
      expect(built).toEqual({ ok: false, error: "Ieraksti derīgumu: no 1 līdz 48 h." });
    }
  });

  it("start Tukums, preset and own hours work", () => {
    expect(base.from).toBe("tukums");
    expect(waybillMobileHours({ hoursPreset: 12, hoursOther: "" })).toBe(12);
    expect(waybillMobileHours({ hoursPreset: null, hoursOther: "36" })).toBe(36);
    expect(waybillMobileHours({ hoursPreset: null, hoursOther: "0" })).toBeNull();
    expect(waybillMobileHours({ hoursPreset: null, hoursOther: "49" })).toBeNull();
    expect(waybillMobileHours({ hoursPreset: null, hoursOther: "" })).toBeNull();
  });

  it("comment only '193 uz BMW 330' sends plate 193 for the default 12 h, and the server accepts it", () => {
    const state = { ...base, comment: "193 uz BMW 330" };
    expect(waybillMobilePlate(state)).toBe("B193-7");
    const built = buildWaybillMobilePayload(state);
    expect(built).toEqual({
      ok: true,
      payload: {
        plate: "B193-7",
        brandModel: "",
        vin: "",
        validHours: 12,
        comment_untrusted: "193 uz BMW 330",
        routeFromAddress: "",
        tradeAct: false,
        representative: "",
      },
    });
    if (!built.ok) return;
    const server = parseCreateWaybillInput(built.payload, new Date("2026-10-22T18:00:00.000Z"));
    expect(server.ok && server.value.brandModel).toBe("BMW 330");
    expect(server.ok && server.value.validUntil).toBe("2026-10-23T06:00:00.000Z");
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

  it("Ar roku / No saraksta: noklusējums nepiespiež sarakstu; pārslēgšana rāda attiecīgos laukus", () => {
    expect(base.autoChoice).toBe("none");
    expect(waybillShowsManualFields(base)).toBe(false);
    expect(waybillShowsTradeList(base)).toBe(false);
    const manual = applyWaybillAutoChoice(base, "manual");
    expect(manual).toMatchObject({ autoChoice: "manual", manual: true, car: null });
    expect(waybillShowsManualFields(manual)).toBe(true);
    expect(waybillShowsTradeList(manual)).toBe(false);
    const withCar = { ...base, car: { id: "c1", brandModel: "Audi A6", vin: "WAUZZZF27LN004512", accepted: true } };
    const fromList = applyWaybillAutoChoice(withCar, "list");
    expect(fromList.autoChoice).toBe("list");
    expect(fromList.manual).toBe(false);
    expect(fromList.car?.brandModel).toBe("Audi A6");
    expect(waybillShowsTradeList(fromList)).toBe(true);
    expect(waybillShowsManualFields(fromList)).toBe(false);
    const switched = applyWaybillAutoChoice(fromList, "manual");
    expect(switched.car).toBeNull();
    expect(waybillShowsManualFields(switched)).toBe(true);
    expect(waybillShowsTradeList(switched)).toBe(false);
    expect(waybillAutoEntryValues(fromList)).toEqual({ brandModel: "Audi A6", vin: "WAUZZZF27LN004512" });
    expect(waybillAutoEntryValues({ ...applyWaybillAutoChoice(base, "manual"), manualBrandModel: " Opel ", manualVin: " ABC " })).toEqual({
      brandModel: "Opel",
      vin: "ABC",
    });
    expect(waybillAutoEntryValues(base)).toEqual({ brandModel: "", vin: "" });
  });

  it("Ar roku: marka/modelis un VIN iet payloadā; bez VIN paliek tukšs", () => {
    const built = buildWaybillMobilePayload({
      ...applyWaybillAutoChoice(base, "manual"),
      manualBrandModel: " Opel Astra ",
      manualVin: " W0L0AHL48B2081234 ",
    });
    expect(built.ok && built.payload).toMatchObject({ brandModel: "Opel Astra", vin: "W0L0AHL48B2081234", tradeAct: false });
    const noVin = buildWaybillMobilePayload({ ...applyWaybillAutoChoice(base, "manual"), manualBrandModel: "Opel Astra" });
    expect(noVin.ok && noVin.payload.vin).toBe("");
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
        representative: "Taivo Batins",
      },
    });
    const iriss = buildWaybillMobilePayload({ ...base, plate: "B193-7", plateTouched: true, car });
    expect(iriss.ok && iriss.payload.representative).toBe("Nils Valainis");
    const picked = buildWaybillMobilePayload({ ...base, car, representative: "Cits Pārstāvis" });
    expect(picked.ok && picked.payload.representative).toBe("Cits Pārstāvis");
    if (!built.ok) return;
    const server = parseCreateWaybillInput(built.payload);
    expect(server.ok && server.value).toMatchObject({ tradeAct: true, routeFrom: "", routeTo: "", representative: "Taivo Batins" });
    // Ar roku ierakstīts auto nekad nav "pieņemts".
    const manual = buildWaybillMobilePayload({ ...base, car, manual: true, manualBrandModel: "Škoda Kodiaq" });
    expect(manual.ok && manual.payload.tradeAct).toBe(false);
  });

  it("j13: noklusējuma pārstāvis pēc auto firmas - ĪRISS: Nils Valainis, Dzintarzeme Auto: Taivo Batins (var mainīt)", () => {
    const car = { id: "c9", brandModel: "Škoda Kodiaq", vin: "TMBJJ7NS1L8012345", accepted: true };
    const dza = buildWaybillMobilePayload({ ...base, plate: "B193-7", plateTouched: true, car: { ...car, owner: "DZA" } });
    expect(dza.ok && dza.payload.representative).toBe("Taivo Batins");
    const iriss = buildWaybillMobilePayload({ ...base, plate: "B192-7", plateTouched: true, car: { ...car, owner: "IRISS" } });
    expect(iriss.ok && iriss.payload.representative).toBe("Nils Valainis");
    const changed = buildWaybillMobilePayload({ ...base, car: { ...car, owner: "DZA" }, representative: "Nils Valainis" });
    expect(changed.ok && changed.payload.representative).toBe("Nils Valainis");
    // Pogas: auto firmas pārstāvis pirmais, tad numura firmas pārstāvis.
    expect(waybillRepresentativeChoices({ owner: "DZA", plate: "B193-7" })).toEqual(["Taivo Batins", "Nils Valainis"]);
    expect(waybillRepresentativeChoices({ owner: "IRISS", plate: "B193-7" })).toEqual(["Nils Valainis"]);
    expect(waybillRepresentativeChoices({ plate: "B192-7" })).toEqual(["Taivo Batins"]);
  });

  it("j13: serveris - akta pieprasījums bez pārstāvja saņem numura firmas noklusējumu; nederīgs pārstāvis - kļūda", () => {
    const body = { plate: "B192-7", brandModel: "Škoda Kodiaq", vin: "TMBJJ7NS1L8012345", validHours: 12, tradeAct: true };
    const dza = parseCreateWaybillInput({ ...body, representative: "" });
    expect(dza.ok && dza.value.representative).toBe("Taivo Batins");
    const iriss = parseCreateWaybillInput({ ...body, plate: "B762-7" });
    expect(iriss.ok && iriss.value.representative).toBe("Nils Valainis");
    expect(parseCreateWaybillInput({ ...body, representative: "<script>" }).ok).toBe(false);
  });

  it("asks for a car or a comment, and for a car in a free comment", () => {
    expect(buildWaybillMobilePayload(base)).toEqual({ ok: false, error: "Izvēlies auto vai ieraksti komentārā." });
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
    stage: "",
    stageAt: "",
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
      { requestId: "wbr_old", status: "issued", statusLabel: "Izdota", text: "", waybillNo: "26A118204", pdfUrl: "/x.pdf", at: "" },
    ];
    const rows = waybillMobileRequestRows(requests, replies, 5, { nowMs: Date.parse("2026-10-22T12:00:00.000Z"), which: "all" });
    expect(rows.map((r) => r.id)).toEqual(["wbr_new", "wbr_old"]);
    expect(rows[0]).toMatchObject({ title: "762 uz Audi", label: "Kļūda", tone: "bad", canRetry: true, errorText: "CSDD nav pieejams" });
    expect(rows[0]?.sub).toContain("B762-7 · 48 h");
    expect(rows[1]).toMatchObject({ title: "BMW 216d", label: "Izdota", tone: "ok", pdfUrl: "/x.pdf", canRetry: false });
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

describe("Izrakstīta, solis N no 3, Arhīvs", () => {
  const now = Date.parse("2026-10-23T12:00:00.000Z");
  it("issued waybill whose time ended is 'Izrakstīta' for 24 h on the first page, then archive only", () => {
    const ended = req({ id: "wbr_end", status: "issued", waybillNo: "P1", validUntil: "2026-10-23T11:00:00.000Z", pdfUrl: "/api/admin/iriss-pavadzimes/p1/pdf" });
    const frozen = JSON.stringify(ended);
    const [row] = waybillMobileRequestRows([ended], [], 5, { nowMs: now });
    expect(row).toMatchObject({ id: "wbr_end", label: "Izrakstīta", tone: "wait", writtenOff: true, line: "Pavadzīme vairs nav derīga. Atrodama Arhīvā.", note: "" });
    expect(row?.sub).toMatch(/^Izrakstīta 23\.10\.2026, \d\d:00 · numurs B193-7 atkal ir brīvs$/);
    expect(waybillMobileRequestRows([ended], [], 5, { nowMs: now + 25 * 3_600_000 })).toEqual([]);
    expect(waybillMobileRequestRows([ended], [], 5, { nowMs: now + 25 * 3_600_000, which: "archive" })[0]?.label).toBe("Izrakstīta");
    expect(JSON.stringify(ended)).toBe(frozen);
  });

  it("a newer issued waybill on the same plate writes the old one off; the plate is then not free", () => {
    const old = req({ id: "wbr_a", status: "issued", createdAt: "2026-10-23T08:00:00.000Z", validUntil: "2026-10-25T08:00:00.000Z" });
    const newer = req({ id: "wbr_b", status: "issued", createdAt: "2026-10-23T10:00:00.000Z", updatedAt: "2026-10-23T10:05:00.000Z", validUntil: "2026-10-25T10:00:00.000Z" });
    expect(waybillWrittenOffAtMs(old, [old, newer], now)).toBe(Date.parse("2026-10-23T10:05:00.000Z"));
    expect(waybillWrittenOffAtMs(newer, [old, newer], now)).toBeNull();
    const rows = waybillMobileRequestRows([old, newer], [], 5, { nowMs: now });
    expect(rows.map((r) => [r.id, r.label])).toEqual([["wbr_b", "Izdota"], ["wbr_a", "Izrakstīta"]]);
    expect(rows[1]?.sub).not.toContain("atkal ir brīvs");
    // Cita numura pavadzīme neko neizraksta.
    const otherPlate = { ...newer, vehicle: { ...newer.vehicle, plate: "B7627" } };
    expect(waybillWrittenOffAtMs(old, [old, otherPlate], now)).toBeNull();
  });

  it("FABLE v3: CSDD vēl rāda to pašu pavadzīmi aktīvu - nav «Izrakstīta … atkal brīvs»", () => {
    // P02827: pieprasīta 1 h, bet CSDD numuru stāvoklī derīga 48 h (B193-7 aizņemts, aplis 46 h).
    const ended = req({ id: "wbr_csdd", status: "issued", waybillNo: "P02827", validUntil: "2026-10-23T11:00:00.000Z" });
    const plates: WaybillPlateState[] = [
      { plate: "B193-7", busy: true, current: { number: "P02827", brandModel: "MERCEDES BENZ", validUntil: "2026-10-25T09:37:00.000Z" } },
    ];
    const [row] = waybillMobileRequestRows([ended], [], 5, { nowMs: now, plates });
    expect(row?.label).toBe("Izdota");
    expect(row?.sub).not.toContain("atkal ir brīvs");
    // Cita pavadzīme uz numura: vecā ir izrakstīta, bet numurs nav brīvs.
    const otherBusy: WaybillPlateState[] = [{ ...plates[0]!, current: { ...plates[0]!.current!, number: "P02900" } }];
    const [off] = waybillMobileRequestRows([ended], [], 5, { nowMs: now, plates: otherBusy });
    expect(off?.label).toBe("Izrakstīta");
    expect(off?.sub).not.toContain("atkal ir brīvs");
    // Bez numuru stāvokļa - kā līdz šim.
    expect(waybillMobileRequestRows([ended], [], 5, { nowMs: now })[0]?.sub).toContain("atkal ir brīvs");
  });

  it("'solis N no 3' under queued, in progress and issued; not under errors or ended pending", () => {
    const rows = waybillMobileRequestRows(
      [
        req({ id: "q", createdAt: "2026-10-23T11:59:00.000Z", updatedAt: "2026-10-23T11:59:00.000Z", validUntil: "2026-10-24T11:59:00.000Z" }),
        req({ id: "w", status: "in_progress", createdAt: "2026-10-23T11:58:00.000Z", updatedAt: "2026-10-23T11:58:30.000Z", pickedAt: "2026-10-23T11:58:30.000Z", stage: "vpn" }),
        req({ id: "i", status: "issued", createdAt: "2026-10-23T11:57:00.000Z", waybillNo: "P9", validUntil: "2026-10-24T10:00:00.000Z", pdfUrl: "/api/admin/iriss-pavadzimes/p9/pdf" }),
        req({ id: "e", status: "error", createdAt: "2026-10-23T11:56:00.000Z", updatedAt: "2026-10-23T11:56:00.000Z", errorReason: "CSDD nav pieejams" }),
      ],
      [],
      5,
      { nowMs: now },
    );
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.q?.line).toBe("Rindā. Aivars sāks pēc brīža. · solis 1 no 3");
    // VPN solis: gaida CSDD savienojumu.
    expect(by.w?.line).toBe("Gaida CSDD savienojumu (VPN). · solis 2 no 3");
    expect(by.i?.line).toMatch(/^Nr\. P9 · derīga līdz 24\.10\.2026, \d\d:00 · solis 3 no 3$/);
    expect(by.i?.note).toBe("Saglabāta Arhīvā");
    expect(by.e?.line).toBe('Neizdevās: CSDD nav pieejams. Spied "Atkārtot".');
  });
});

describe("live progress", () => {
  const t0 = "2026-10-23T10:00:00.000Z";
  const at = (min: number) => Date.parse(t0) + min * 60_000;
  it("j16: automātika - 2 min bez sākuma un 4 min bez jauna soļa saka skaidri, nevis klusi gaida", () => {
    const live = { autoMode: "live" as const, autoStandard: true };
    expect(waybillMobileProgress(req({ createdAt: t0, updatedAt: t0 }), at(1), live).text).toBe("Rindā automātikai. Sāks pēc brīža.");
    expect(waybillMobileProgress(req({ createdAt: t0, updatedAt: t0 }), at(3), live).text).toContain("2 min laikā darbu nesāka");
    const notAuto = { autoMode: "live" as const, autoStandard: false, autoReason: "cits pārstāvis" };
    expect(waybillMobileProgress(req({ createdAt: t0, updatedAt: t0 }), at(1), notAuto).text).toBe(
      "Automātikai neder (cits pārstāvis). Izraksta Aivars.",
    );
    const working = req({ status: "in_progress", pickedAt: t0, stage: "filling", stageAt: t0 });
    expect(waybillMobileProgress(working, at(2)).text).toBe("Aizpilda CSDD formu...");
    expect(waybillMobileProgress(working, at(6)).text).toContain("Automātika nav ziņojusi 6 min");
  });

  it("moves through 3 steps by real events only: time alone never grows the bar", () => {
    const queued = waybillMobileProgress(req({ createdAt: t0, updatedAt: t0 }), at(1));
    expect(queued).toMatchObject({ step: 1, text: "Rindā. Aivars sāks pēc brīža." });
    const slow = waybillMobileProgress(req({ createdAt: t0, updatedAt: t0 }), at(16));
    expect(slow.step).toBe(1);
    expect(slow.text).toContain("Gaida ilgāk nekā parasti");
    expect(slow.pct).toBe(queued.pct);
    const startWork = waybillMobileProgress(req({ status: "in_progress", pickedAt: t0, updatedAt: t0 }), at(0));
    const later = waybillMobileProgress(req({ status: "in_progress", pickedAt: t0, updatedAt: t0 }), at(30));
    expect(startWork.step).toBe(2);
    expect(later.pct).toBe(startWork.pct);
    // Worker soļi: paņemts -> VPN -> forma -> Saglabāt -> PDF; josla aug tikai ar tiem.
    const stages = (["claimed", "vpn", "filling", "saving", "pdf"] as const).map((stage) =>
      waybillMobileProgress(req({ status: "in_progress", pickedAt: t0, stage }), at(1)),
    );
    expect(stages.map((p) => p.text)).toEqual([
      "Automātika paņēma darbā.",
      "Gaida CSDD savienojumu (VPN).",
      "Aizpilda CSDD formu...",
      "Saglabā CSDD...",
      "Saglabāta CSDD, ielādē PDF...",
    ]);
    for (let i = 1; i < stages.length; i++) expect(stages[i]!.pct).toBeGreaterThan(stages[i - 1]!.pct);
    const done = waybillMobileProgress(req({ status: "issued", waybillNo: "26A1", validUntil: "2026-10-25T10:00:00.000Z" }), at(3));
    expect(done).toEqual({ step: 3, pct: 100, text: "Nr. 26A1 · derīga līdz 25.10.2026, 12:00" });
  });

  it("test mode says honestly that Aivars issues by hand; live mode says queued for automation", () => {
    const q = req({ createdAt: t0, updatedAt: t0, validUntil: "2026-10-23T12:00:00.000Z" });
    expect(waybillMobileProgress(q, at(1), { autoMode: "test", autoStandard: true }).text).toBe(
      "Automātika testa režīmā - pavadzīmi izraksta Aivars ar roku",
    );
    expect(waybillMobileProgress(q, at(1), { autoMode: "live", autoStandard: true }).text).toBe("Rindā automātikai. Sāks pēc brīža.");
    expect(waybillMobileProgress(q, at(1), { autoMode: "live", autoStandard: false }).text).toBe("Rindā. Aivars sāks pēc brīža.");
  });

  it("a pending request whose validity already ended: 'Termiņš beidzies - atcel un izveido jaunu', no retry, can cancel", () => {
    // wbr_721441d096035496: Peugeot 5008, B193-7, 1 h, 14:14 - vēl Gaida pēc 15:14.
    const peugeot = req({
      id: "wbr_721441d096035496",
      createdAt: "2026-10-23T11:14:00.000Z",
      updatedAt: "2026-10-23T11:14:00.000Z",
      validHours: 1,
      validUntil: "2026-10-23T12:14:00.000Z",
      vehicle: { brandModel: "PEUGEOT 5008", vin: "VF30ARHHAAS201388", plate: "B1937", orderId: "" },
    });
    const now = Date.parse("2026-10-23T12:30:00.000Z");
    expect(waybillMobileProgress(peugeot, now, { autoMode: "test" }).text).toBe("Termiņš beidzies - atcel un izveido jaunu");
    const [row] = waybillMobileRequestRows([peugeot], [], 5, { nowMs: now });
    expect(row).toMatchObject({ label: "Gaida", canRetry: false, canCancel: true, progress: { text: "Termiņš beidzies - atcel un izveido jaunu" } });
  });

  it("'Atcelt' only while pending and unclaimed; cancelled requests leave the queue", () => {
    const now = Date.parse("2026-10-23T10:05:00.000Z");
    const base = { createdAt: t0, updatedAt: t0, validUntil: "2026-10-25T10:00:00.000Z" };
    const rows = waybillMobileRequestRows(
      [
        req({ id: "wbr_q", ...base }),
        req({ id: "wbr_w", ...base, status: "in_progress", pickedBy: "auto", pickedAt: t0 }),
        req({ id: "wbr_i", ...base, status: "issued", waybillNo: "P1" }),
        req({ id: "wbr_c", ...base, status: "cancelled" }),
      ],
      [],
      5,
      { nowMs: now },
    );
    expect(rows.map((r) => [r.id, r.canCancel])).toEqual([
      ["wbr_q", true],
      ["wbr_w", false],
      ["wbr_i", false],
    ]);
    const [archived] = waybillMobileRequestRows([req({ id: "wbr_c", ...base, status: "cancelled" })], [], 5, { nowMs: now, which: "archive" });
    expect(archived).toMatchObject({ id: "wbr_c", label: "Atcelts", canCancel: false });
  });

  it("error after save asks to check CSDD before retry", () => {
    const err = waybillMobileProgress(req({ status: "error", pickedAt: t0, errorReason: "Automātika: x. Pārbaudi CSDD, vai pavadzīme izveidota." }));
    expect(err.text).toBe("Iespējams, pavadzīme CSDD jau ir izveidota. Pārbaudi, pirms atkārto.");
    expect(waybillMobileProgress(req({ status: "error", errorReason: "CSDD nav pieejams." })).text).toBe('Neizdevās: CSDD nav pieejams. Spied "Atkārtot".');
  });
});
