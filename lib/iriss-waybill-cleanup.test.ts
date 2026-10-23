import { describe, expect, it } from "vitest";
import { cleanupReason, planWaybillCleanup } from "@/scripts/iriss-ttr/cleanup-waybill-requests-core.mjs";

const NOW = Date.parse("2026-10-23T15:00:00.000Z");
const r = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "queued",
  waybillNo: "",
  errorReason: "",
  pickedAt: "",
  updatedAt: "2026-10-23T14:00:00.000Z",
  validUntil: "2026-10-23T16:00:00.000Z",
  vehicle: { plate: "B193-7", brandModel: "VW ARTEON" },
  ...over,
});

describe("cleanup-waybill-requests: plāns", () => {
  const doc = {
    version: 1,
    requests: [
      r("wbr_721441d096035496", { validUntil: "2026-10-23T12:14:00.000Z", vehicle: { plate: "B193-7", brandModel: "PEUGEOT 5008" } }),
      r("wbr_71eb5104911eeca4"),
      r("wbr_cx", { status: "cancelled" }),
      r("wbr_err", { status: "error", errorReason: "CSDD nav pieejams" }),
      r("wbr_check", { status: "error", errorReason: "Automātika: timeout. Pārbaudi CSDD, vai pavadzīme jau ir izveidota." }),
      r("wbr_issued", { status: "issued", waybillNo: "P02811" }),
      r("wbr_issued_old", { status: "issued", waybillNo: "P02700", validUntil: "2026-10-01T10:00:00.000Z" }),
      r("wbr_no_status_but_no", { status: "error", waybillNo: "P02812" }),
      r("wbr_work", { status: "in_progress", pickedAt: "2026-10-23T14:55:00.000Z" }),
      r("wbr_stuck", { status: "in_progress", pickedAt: "2026-10-23T13:00:00.000Z" }),
    ],
    events: [
      { id: "e1", requestId: "wbr_71eb5104911eeca4" },
      { id: "e2", requestId: "wbr_issued" },
      { id: "e3", requestId: "wbr_gone" },
      { id: "e4", requestId: "wbr_work" },
    ],
  };

  it("never deletes issued waybills (any with a number), running work or 'Pārbaudi CSDD' errors", () => {
    const plan = planWaybillCleanup(doc, NOW);
    const keptIds = (plan.next.requests as Array<{ id: string }>).map((x) => x.id);
    expect(keptIds).toEqual(["wbr_check", "wbr_issued", "wbr_issued_old", "wbr_no_status_but_no", "wbr_work"]);
    expect(plan.removed.map((x) => [x.id, x.reason])).toEqual([
      ["wbr_721441d096035496", "gaida, termiņš beidzies"],
      ["wbr_71eb5104911eeca4", "gaida"],
      ["wbr_cx", "atcelts"],
      ["wbr_err", "kļūda"],
      ["wbr_stuck", "novecojis izveido"],
    ]);
    // Notikumi: dzēsto un bāreņu notikumi prom, pārējie paliek.
    expect((plan.next.events as Array<{ id: string }>).map((e) => e.id)).toEqual(["e2", "e4"]);
    expect(plan.removedEvents).toBe(2);
    // Oriģinālais dokuments netiek mainīts (backup = tieši tas, kas bija).
    expect(doc.requests).toHaveLength(10);
  });

  it("is idempotent: a second run removes nothing", () => {
    const once = planWaybillCleanup(doc, NOW);
    const twice = planWaybillCleanup(once.next, NOW);
    expect(twice.removed).toEqual([]);
    expect(twice.removedEvents).toBe(0);
  });

  it("cleanupReason keeps unknown shapes", () => {
    expect(cleanupReason(null, NOW)).toBe("");
    expect(cleanupReason(r("x", { status: "issued" }), NOW)).toBe("");
  });
});
