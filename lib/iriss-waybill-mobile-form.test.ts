import { describe, expect, it } from "vitest";
import {
  buildWaybillMobilePayload,
  firstFreeWaybillPlate,
  initialWaybillMobileForm,
  waybillMobileHours,
  waybillMobilePlate,
  waybillMobileRequestRows,
} from "@/lib/iriss-waybill-mobile-form";
import { parseCreateWaybillInput } from "@/lib/iriss-waybill-create";
import type { WaybillAivarsReply, WaybillRequest } from "@/lib/iriss-waybill-requests";

const base = initialWaybillMobileForm("B192-7");

describe("phone waybill form", () => {
  it("defaults to 48 h and Tukums -> Tukums, preset and own hours work", () => {
    expect(base.hoursPreset).toBe(48);
    expect(base.from).toBe("tukums");
    expect(base.to).toBe("tukums");
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
        routeToAddress: "",
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

  it("'Cits' route needs an address; Tukums sends defaults", () => {
    const car = { id: "c1", brandModel: "BMW 330", vin: "" };
    expect(buildWaybillMobilePayload({ ...base, car, from: "other", fromAddress: " " })).toEqual({
      ok: false,
      error: "Ieraksti sākuma adresi.",
    });
    expect(buildWaybillMobilePayload({ ...base, car, to: "other", toAddress: "" })).toEqual({
      ok: false,
      error: "Ieraksti galamērķa adresi.",
    });
    const built = buildWaybillMobilePayload({ ...base, car, to: "other", toAddress: "Rīga, Brīvības 275" });
    expect(built.ok && built.payload.routeToAddress).toBe("Rīga, Brīvības 275");
    expect(built.ok && built.payload.routeFromAddress).toBe("");
    // "Cits" adrese paliek ievadītajā laukā, bet netiek sūtīta, ja izvēlēts Tukums.
    const back = buildWaybillMobilePayload({ ...base, car, to: "tukums", toAddress: "Rīga" });
    expect(back.ok && back.payload.routeToAddress).toBe("");
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
    const rows = waybillMobileRequestRows(requests, replies);
    expect(rows.map((r) => r.id)).toEqual(["wbr_new", "wbr_old"]);
    expect(rows[0]).toMatchObject({ title: "762 uz Audi", label: "Kļūda", tone: "bad", canRetry: true, errorText: "CSDD nav pieejams" });
    expect(rows[0]?.sub).toContain("B762-7 · 48 h");
    expect(rows[1]).toMatchObject({ title: "BMW 216d", label: "Izdota", tone: "ok", pdfUrl: "/x.pdf", canRetry: false });
    expect(rows[1]?.sub.startsWith("26A118204 · B193-7 · 48 h")).toBe(true);
  });
});
