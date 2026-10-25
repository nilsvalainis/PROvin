import { describe, expect, it } from "vitest";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";
import {
  AIVARS_ACTION_STOP_WAYBILL,
  decideWaybillStop,
  isWaybillCsddNo,
  isWaybillStopRequest,
  pendingStopForWaybill,
  toAivarsStopWaybillAction,
  waybillStopConfirmText,
  waybillStopStatusLabel,
} from "@/lib/iriss-waybill-stop";

const stopReq = (over: Partial<WaybillRequest> = {}): WaybillRequest => ({
  id: "wbr_stop1",
  createdBy: "usr_1",
  createdByName: "Nils",
  createdAt: "2026-10-25T20:00:00.000Z",
  updatedAt: "2026-10-25T20:00:00.000Z",
  vehicle: { brandModel: "VW Golf", vin: "", plate: "B193-7", orderId: "" },
  routeFrom: "",
  routeTo: "",
  validDays: 1,
  validHours: 1,
  validFrom: "2026-10-25T20:00:00.000Z",
  validUntil: "2026-10-26T20:00:00.000Z",
  noteUntrusted: "",
  status: "queued",
  waybillNo: "",
  pdfUrl: "",
  errorReason: "",
  lastReplyText: "Saņemts. Pārtrauc CSDD (Aivars).",
  attempts: 1,
  pickedBy: "",
  pickedAt: "",
  plateBusyAtCreate: true,
  autoDisabled: true,
  tradeAct: false,
  representative: "",
  stage: "",
  stageAt: "",
  dropboxPath: "",
  dropboxError: "",
  dropboxAt: "",
  kind: "stop",
  stopWaybillNo: "P02819",
  ...over,
});

describe("waybill stop helpers", () => {
  it("builds the confirmation line with CSDD number and plate", () => {
    expect(waybillStopConfirmText("P02819", "B193-7")).toBe("Pārtraukt pavadzīmi Nr. P02819 (B193-7)?");
    expect(waybillStopConfirmText("p02819", "B1937")).toBe("Pārtraukt pavadzīmi Nr. P02819 (B193-7)?");
  });

  it("accepts only CSDD waybill numbers", () => {
    expect(isWaybillCsddNo("P02819")).toBe(true);
    expect(isWaybillCsddNo("P028191")).toBe(true);
    expect(isWaybillCsddNo("26A1")).toBe(false);
    expect(isWaybillCsddNo("")).toBe(false);
  });

  it("reuses a pending stop for the same number (idempotent)", () => {
    expect(
      decideWaybillStop({
        number: "P02819",
        plate: "B193-7",
        lifecycle: "active",
        withdrawn: false,
        pending: { id: "wbr_stop1", kind: "stop", stopWaybillNo: "P02819", plate: "B193-7" },
      }),
    ).toEqual({ action: "reuse", requestId: "wbr_stop1" });
  });

  it("does not queue a second job when another request already holds the plate", () => {
    expect(
      decideWaybillStop({
        number: "P02819",
        plate: "B193-7",
        lifecycle: "active",
        withdrawn: false,
        pending: { id: "wbr_create", kind: "create", plate: "B193-7" },
      }),
    ).toEqual({ action: "conflict", pendingId: "wbr_create" });
  });

  it("is a no-op when CSDD already withdrew the waybill", () => {
    expect(
      decideWaybillStop({
        number: "P02819",
        plate: "B193-7",
        lifecycle: "interrupted",
        withdrawn: true,
        pending: null,
      }),
    ).toEqual({ action: "already_stopped" });
  });

  it("refuses a missing CSDD number instead of inventing a stop job", () => {
    expect(
      decideWaybillStop({
        number: "26A1",
        plate: "B193-7",
        lifecycle: "active",
        withdrawn: false,
        pending: null,
      }),
    ).toEqual({ action: "invalid_number" });
  });

  it("queues a new stop when the plate is free of other jobs", () => {
    expect(
      decideWaybillStop({
        number: "P02819",
        plate: "B193-7",
        lifecycle: "active",
        withdrawn: false,
        pending: null,
      }),
    ).toEqual({ action: "queue" });
  });

  it("finds the pending stop by CSDD number", () => {
    const now = Date.parse("2026-10-25T20:10:00.000Z");
    expect(pendingStopForWaybill([stopReq(), stopReq({ id: "wbr_other", stopWaybillNo: "P02820" })], "P02819", now)?.id).toBe(
      "wbr_stop1",
    );
    expect(pendingStopForWaybill([stopReq({ status: "issued" })], "P02819", now)).toBeNull();
  });

  it("maps a stop request to Aivars stop_waybill without create fields", () => {
    const action = toAivarsStopWaybillAction(stopReq());
    expect(action).toEqual({
      action: AIVARS_ACTION_STOP_WAYBILL,
      id: "wbr_stop1",
      createdAt: "2026-10-25T20:00:00.000Z",
      waybillNo: "P02819",
      vehicle: { vin: "", plate: "B193-7", brandModel: "VW Golf" },
    });
    expect(JSON.stringify(action)).not.toMatch(/replaceWaybillNo|comment_untrusted|Anulēt|Paziņot/);
    expect(isWaybillStopRequest(stopReq())).toBe(true);
    expect(isWaybillStopRequest({ kind: "create", stopWaybillNo: "P02819" })).toBe(false);
  });

  it("labels stop progress without the create-waybill words", () => {
    expect(waybillStopStatusLabel("queued")).toBe("Gaida");
    expect(waybillStopStatusLabel("in_progress")).toBe("Pārtrauc");
    expect(waybillStopStatusLabel("issued")).toBe("Pārtraukta");
    expect(waybillStopStatusLabel("queued", true)).toBe("Novecojis");
  });
});
