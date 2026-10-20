import { describe, expect, it } from "vitest";
import {
  inProgressIsStale,
  parseWaybillRequest,
  remainingWaybillDays,
  waybillAivarsReply,
  waybillChatPayload,
  waybillChatTimeline,
  waybillSoonTone,
  type WaybillRequest,
  type WaybillRequestsDoc,
} from "@/lib/iriss-waybill-requests";

const sample = (over: Partial<WaybillRequest> = {}): WaybillRequest => ({
  id: "wbr_abcdefgh",
  createdBy: "usr_abcdefgh",
  createdByName: "Jānis",
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  vehicle: { brandModel: "VW Passat", vin: "WVWZZZ3CZE1234567", plate: "B193-7", orderId: "" },
  routeFrom: "Bremen",
  routeTo: "Riga",
  validDays: 10,
  validFrom: "2026-10-20",
  validUntil: "2026-10-30",
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
});

describe("waybill requests", () => {
  it("maps a legacy freeText field to noteUntrusted", () => {
    const raw = { ...sample(), freeText: "a\u0007b" } as Record<string, unknown>;
    delete raw.noteUntrusted;
    expect(parseWaybillRequest(raw)?.noteUntrusted).toBe("a b");
  });

  it("parses a queued request and builds chat order", () => {
    const req = parseWaybillRequest(sample());
    expect(req?.status).toBe("queued");
    const doc: WaybillRequestsDoc = {
      version: 1,
      updatedAt: "2026-10-20T10:01:00.000Z",
      requests: [req!],
      events: [
        {
          id: "wbe_1",
          requestId: req!.id,
          kind: "received",
          text: "Saņemts",
          waybillNo: "",
          pdfUrl: "",
          createdAt: "2026-10-20T10:00:05.000Z",
          by: "aivars",
        },
      ],
    };
    const timeline = waybillChatTimeline(doc);
    expect(timeline.map((i) => i.type)).toEqual(["request", "event"]);
  });

  it("marks in-progress older than 30 min as stale", () => {
    const now = Date.parse("2026-10-20T11:00:00.000Z");
    expect(
      inProgressIsStale(
        sample({ status: "in_progress", pickedAt: "2026-10-20T10:00:00.000Z" }),
        now,
      ),
    ).toBe(true);
    expect(
      inProgressIsStale(
        sample({ status: "in_progress", pickedAt: "2026-10-20T10:50:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });

  it("colors remaining days: orange under 5, expired at 0", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    expect(remainingWaybillDays("2026-10-26T12:00:00.000Z", now)).toBe(6);
    expect(waybillSoonTone(6)).toBe("ok");
    expect(waybillSoonTone(4)).toBe("soon");
    expect(waybillSoonTone(0)).toBe("expired");
  });

  it("reads lastReplyText and builds Aivars status plus result per request", () => {
    const raw = { ...sample(), last_reply_text: "CSDD: izdota B193-7" };
    const parsed = parseWaybillRequest(raw);
    expect(parsed?.lastReplyText).toBe("CSDD: izdota B193-7");
    const issued = sample({
      status: "issued",
      waybillNo: "B861-6",
      pdfUrl: "/api/admin/iriss-pavadzimes/wb1/pdf",
      lastReplyText: "",
    });
    const reply = waybillAivarsReply(issued, [
      {
        id: "wbe_2",
        requestId: issued.id,
        kind: "issued",
        text: "Izdota B861-6",
        waybillNo: "B861-6",
        pdfUrl: "/api/admin/iriss-pavadzimes/wb1/pdf",
        createdAt: "2026-10-20T10:05:00.000Z",
        by: "aivars",
      },
    ]);
    expect(reply.statusLabel).toBe("Izveidota");
    expect(reply.text).toBe("Izdota B861-6");
    expect(reply.waybillNo).toBe("B861-6");
    const payload = waybillChatPayload({
      version: 1,
      updatedAt: "2026-10-20T10:05:00.000Z",
      requests: [sample({ status: "issued", waybillNo: "B861-6", lastReplyText: "Izdota B861-6" })],
      events: [],
    });
    expect(payload.replies[0]?.status).toBe("issued");
    expect(payload.replies[0]?.text).toBe("Izdota B861-6");
    expect(payload.replies[0]?.waybillNo).toBe("B861-6");
  });
});
