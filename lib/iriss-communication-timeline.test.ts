import { describe, expect, it } from "vitest";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  appendIrissCommunicationEvent,
  deriveIrissCommunicationTimeline,
  filterIrissCommunicationTimeline,
  newIrissCommunicationEvent,
  normalizeIrissCommunicationEvents,
} from "@/lib/iriss-communication-timeline";

describe("iriss-communication-timeline", () => {
  it("does not invent stored events from empty JSON", () => {
    expect(normalizeIrissCommunicationEvents(undefined)).toBeUndefined();
    expect(normalizeIrissCommunicationEvents([])).toBeUndefined();
  });

  it("builds a timeline from existing notes, status, offers and advance", () => {
    const rec = emptyIrissPasutijums("ord-1", "2026-10-15T10:00:00.000Z");
    rec.notes = "17.10 14:05 Klients vēlas tumšu krāsu.";
    rec.statusHistory = [
      { from: "searching", to: "active", at: "2026-10-15T09:12:00.000Z", by: "operators" },
    ];
    rec.offers = [emptyIrissOfferRecord("off-1", "2026-10-16T08:00:00.000Z", "Volvo S60")];
    rec.advance = { amount: "200", paidAt: "2026-10-17", method: "transfer", invoiceNo: "DZA-1" };
    const items = deriveIrissCommunicationTimeline({
      notes: rec.notes,
      statusHistory: rec.statusHistory,
      offers: rec.offers,
      advance: rec.advance,
    });
    expect(items.some((row) => row.kind === "note")).toBe(true);
    expect(items.some((row) => row.kind === "status")).toBe(true);
    expect(items.some((row) => row.kind === "offer")).toBe(true);
    expect(items.some((row) => row.kind === "advance" && row.title.includes("200"))).toBe(true);
    expect(filterIrissCommunicationTimeline(items, "advance")).toHaveLength(1);
    expect(items.map((row) => row.title).join(" ")).not.toMatch(/[\u2013\u2014]/);
  });

  it("keeps operator-logged events and does not drop existing notes", () => {
    const stored = [
      newIrissCommunicationEvent("call", "Zvans klientam", { status: "answered", durationMin: 6 }),
    ];
    const next = appendIrissCommunicationEvent(stored, newIrissCommunicationEvent("whatsapp", "WhatsApp", { status: "sent" }));
    const items = deriveIrissCommunicationTimeline({
      notes: "Saglabāta piezīme",
      storedEvents: next,
    });
    expect(items.some((row) => row.kind === "call")).toBe(true);
    expect(items.some((row) => row.kind === "whatsapp")).toBe(true);
    expect(items.some((row) => row.kind === "note")).toBe(true);
  });
});
