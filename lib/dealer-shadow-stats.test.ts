import { describe, expect, it } from "vitest";
import { mergeDealerDataJobPatch } from "@/lib/dealer-data-job-merge";
import { normalizeDealerDataJob, type DealerDataJob } from "@/lib/dealer-data-job-types";
import { buildDealerShadowStats, dealerShadowStatsLine } from "@/lib/dealer-shadow-stats";
import { dealerShadowGateLabel, normalizeDealerShadowGate, type DealerShadowGate } from "@/lib/dealer-shadow-types";

const gate = (verdict: "would_send" | "would_hold", at = "2026-11-22T10:00:00.000Z"): DealerShadowGate => ({
  verdict,
  at,
  version: 1,
  checks:
    verdict === "would_hold"
      ? [
          { id: "raw_dates", title: "Datumi", state: "fail", severity: "block", reason: "x" },
          { id: "pdf", title: "PDF", state: "fail", severity: "warn", reason: "y" },
        ]
      : [{ id: "raw_dates", title: "Datumi", state: "ok", severity: "block", reason: "" }],
});

const job = (id: string, over: Partial<DealerDataJob>): DealerDataJob => ({
  sessionId: id,
  vin: "WBAMZ71040DM71041",
  status: "done",
  attempts: 1,
  createdAt: "2026-11-22T09:00:00.000Z",
  updatedAt: "2026-11-22T09:00:00.000Z",
  ...over,
});

describe("buildDealerShadowStats", () => {
  it("skaita sūtītu / aizturētu un atsauksmes", () => {
    const stats = buildDealerShadowStats([
      job("a", { shadowGate: gate("would_send"), shadowFeedback: { correct: true, note: "", at: "t" } }),
      job("b", { shadowGate: gate("would_send"), shadowFeedback: { correct: false, note: "nepareizs datums", at: "t" } }),
      job("c", { shadowGate: gate("would_hold"), shadowFeedback: { correct: true, note: "", at: "t" } }),
      job("d", { shadowGate: gate("would_hold") }),
      job("e", {}),
    ]);
    expect(stats).toMatchObject({
      total: 4,
      wouldSend: 2,
      wouldSendCorrected: 1,
      wouldHold: 2,
      wouldHoldJustified: 1,
      withFeedback: 3,
      blockCounts: { raw_dates: 2 },
    });
    expect(stats.rows.find((r) => r.sessionId === "c")).toMatchObject({ blocks: ["raw_dates"], warns: ["pdf"] });
    expect(dealerShadowStatsLine(stats)).toBe(
      "Ēnu režīms: 4 pasūtījumi, sistēma sūtītu 2 (labots pēc tam 1), aizturētu 2 (pamatoti 1)",
    );
  });

  it("bez spriedumiem rīta rindas nav; sinceMs filtrē", () => {
    expect(dealerShadowStatsLine(buildDealerShadowStats([job("e", {})]))).toBeNull();
    const s = buildDealerShadowStats([job("a", { shadowGate: gate("would_send", "2026-11-01T00:00:00.000Z") })], {
      sinceMs: Date.parse("2026-11-10T00:00:00.000Z"),
    });
    expect(s.total).toBe(0);
  });
});

describe("ēnu lauki darba ierakstā", () => {
  it("normalizācija: spriedums vienmēr no pārbaudēm; etiķete", () => {
    const g = normalizeDealerShadowGate({ ...gate("would_hold"), verdict: "would_send" })!;
    expect(g.verdict).toBe("would_hold");
    expect(dealerShadowGateLabel(g)).toBe("Sistēma aizturētu · 1 iemesls");
    expect(dealerShadowGateLabel(gate("would_send"))).toBe("Sistēma sūtītu");
    expect(normalizeDealerShadowGate({ checks: "x" })).toBeUndefined();
  });

  it("upsert patch saglabā spriedumu un atsauksmi; VIN maiņā tie tiek nomesti", () => {
    const current = normalizeDealerDataJob(
      job("s1", { shadowGate: gate("would_send"), shadowFeedback: { correct: true, note: "", at: "t" } }),
      "s1",
    )!;
    const same = mergeDealerDataJobPatch("s1", current, { vin: current.vin, status: "running" });
    expect(same.shadowGate?.verdict).toBe("would_send");
    expect(same.shadowFeedback?.correct).toBe(true);
    const changed = mergeDealerDataJobPatch("s1", current, { vin: "W0LJ7BJBSBV658020" });
    expect(changed.shadowGate).toBeUndefined();
    expect(changed.shadowFeedback).toBeUndefined();
    expect(normalizeDealerDataJob(JSON.parse(JSON.stringify(same)), "s1")?.shadowGate?.checks).toHaveLength(1);
  });
});
