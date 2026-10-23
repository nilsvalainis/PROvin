import { describe, expect, it } from "vitest";
import {
  inProgressIsStale,
  isStaleWaybillRequest,
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
  validHours: 48,
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
  plateBusyAtCreate: false,
  autoDisabled: false,
  tradeAct: false,
  representative: "",
  ...over,
});

describe("waybill requests", () => {
  it("maps a legacy freeText field to noteUntrusted", () => {
    const raw = { ...sample(), freeText: "a\u0007b" } as Record<string, unknown>;
    delete raw.noteUntrusted;
    expect(parseWaybillRequest(raw)?.noteUntrusted).toBe("a b");
  });

  it("reads comment_untrusted and ISO validity timestamps", () => {
    const raw = {
      ...sample(),
      validFrom: "2026-10-20T16:50:00.000Z",
      validUntil: "2026-10-22T16:50:00.000Z",
      comment_untrusted: "B762 uz 48h",
    } as Record<string, unknown>;
    delete raw.noteUntrusted;
    const parsed = parseWaybillRequest(raw);
    expect(parsed?.noteUntrusted).toBe("B762 uz 48h");
    expect(parsed?.validFrom).toBe("2026-10-20T16:50:00.000Z");
    expect(parsed?.validHours).toBe(48);
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
    expect(reply.statusLabel).toBe("Izdota");
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

describe("novecojuši pieprasījumi (24 h bez virzības)", () => {
  it("Gaida/Izveido ilgāk par 24 h kopš pēdējām izmaiņām ir novecojis; izrakstīta un kļūda nav", () => {
    const t = Date.parse("2026-10-21T10:00:00.000Z");
    const q = sample({ status: "queued", createdAt: "2026-10-20T09:00:00.000Z", updatedAt: "2026-10-20T09:00:00.000Z" });
    expect(isStaleWaybillRequest(q, t)).toBe(true);
    expect(isStaleWaybillRequest({ ...q, updatedAt: "2026-10-20T11:00:00.000Z" }, t)).toBe(false);
    expect(isStaleWaybillRequest({ ...q, status: "in_progress" }, t)).toBe(true);
    expect(isStaleWaybillRequest({ ...q, status: "issued" }, t)).toBe(false);
    expect(isStaleWaybillRequest({ ...q, status: "error" }, t)).toBe(false);
  });

  it("atbildē statuss 'Novecojis', ieraksts nemainās", () => {
    const q = sample({ status: "queued", createdAt: "2026-10-20T09:00:00.000Z", updatedAt: "2026-10-20T09:00:00.000Z" });
    const before = JSON.stringify(q);
    const reply = waybillAivarsReply(q, [], Date.parse("2026-10-22T09:00:00.000Z"));
    expect(reply.statusLabel).toBe("Novecojis");
    expect(reply.status).toBe("queued");
    expect(JSON.stringify(q)).toBe(before);
  });

  it("tirdzniecības akta lauki tiek nolasīti; bez tradeAct pārstāvis netiek glabāts", () => {
    const raw = { ...sample(), tradeAct: true, representative: "Taivo Batiņš" };
    expect(parseWaybillRequest(raw)).toMatchObject({ tradeAct: true, representative: "Taivo Batiņš" });
    expect(parseWaybillRequest({ ...sample(), representative: "X" })).toMatchObject({ tradeAct: false, representative: "" });
  });
});
