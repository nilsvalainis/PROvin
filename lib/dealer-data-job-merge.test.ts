import { describe, expect, it } from "vitest";

import { dealerDataJobBelongsInSweepIndex, mergeDealerDataJobPatch } from "@/lib/dealer-data-job-merge";
import { dealerDataJobBlocksManualPurchase, type DealerDataJob } from "@/lib/dealer-data-job-types";

const VIN = "WAUZZZ4M0JD000001";
const base: DealerDataJob = {
  sessionId: "s1",
  vin: VIN,
  status: "running",
  attempts: 1,
  createdAt: "2026-11-20T00:00:00.000Z",
  updatedAt: "2026-11-20T00:00:00.000Z",
  paidOutcomes: { oe_service_history: "ok" },
  oneautoResults: { oe_service_history: { ok: true, payload: { result: { service_events: [{ date: "x" }] } } } },
};

describe("mergeDealerDataJobPatch", () => {
  it("ok rezultāts netiek pārrakstīts ar pending/kļūdu", () => {
    const next = mergeDealerDataJobPatch("s1", base, {
      vin: VIN,
      oneautoResults: {
        oe_service_history: { ok: false, error: "pending", payload: null },
        vin_decoder: { ok: true, payload: { a: 1 } },
      },
      paidOutcomes: { oe_service_history: "pending" },
    });
    expect((next.oneautoResults?.oe_service_history as { ok: boolean }).ok).toBe(true);
    expect(next.oneautoResults?.vin_decoder).toBeTruthy();
    expect(next.paidOutcomes?.oe_service_history).toBe("ok");
  });

  it("VIN maiņa: vecie dati arhīvā, jaunajam tukšs sākums", () => {
    const next = mergeDealerDataJobPatch("s1", base, { vin: "WAUZZZ4M0JD999999" });
    expect(next.oneautoResults).toBeUndefined();
    expect(next.paidOutcomes).toBeUndefined();
    expect(next.attempts).toBe(0);
    expect(next.archived?.[0]).toMatchObject({ vin: VIN, paidOutcomes: { oe_service_history: "ok" } });
  });

  it("runId: '' atbrīvo nomu; done nomu neglabā", () => {
    const withRun = mergeDealerDataJobPatch("s1", base, { vin: VIN, runId: "run_1" });
    expect(withRun.runId).toBe("run_1");
    expect(mergeDealerDataJobPatch("s1", withRun, { vin: VIN, runId: "" }).runId).toBeUndefined();
    expect(mergeDealerDataJobPatch("s1", withRun, { vin: VIN, status: "done" }).runId).toBeUndefined();
  });

  it("atmaksa netiek nomesta", () => {
    const refunded = { ...base, refund: { at: "x", amountCents: 2499, stripeRefundId: "re_1", by: "a", reason: "r" } };
    expect(mergeDealerDataJobPatch("s1", refunded, { vin: VIN, status: "done" }).refund?.stripeRefundId).toBe("re_1");
  });
});

describe("slaucīšanas indekss", () => {
  it("gala kļūda ar nosūtītu paziņojumu - ārā no indeksa", () => {
    expect(dealerDataJobBelongsInSweepIndex({ status: "failed", attempts: 3, alert: { key: "failed_final", at: "x" } })).toBe(false);
    expect(dealerDataJobBelongsInSweepIndex({ status: "failed", attempts: 3 })).toBe(true);
    expect(dealerDataJobBelongsInSweepIndex({ status: "failed", attempts: 1 })).toBe(true);
    expect(dealerDataJobBelongsInSweepIndex({ status: "done", attempts: 1 })).toBe(false);
    expect(dealerDataJobBelongsInSweepIndex({ status: "no_vin", attempts: 0 })).toBe(false);
  });
});

describe("manuālās joslas bloķēšana", () => {
  const now = Date.parse("2026-11-20T12:00:00.000Z");
  it("running (svaigs), pending un 202 gaidīšana bloķē; iestrēdzis/pabeigts - nē", () => {
    expect(dealerDataJobBlocksManualPurchase({ status: "pending", updatedAt: "x" }, now)).toBe(true);
    expect(
      dealerDataJobBlocksManualPurchase({ status: "running", startedAt: "2026-11-20T11:58:00.000Z", updatedAt: "x" }, now),
    ).toBe(true);
    expect(
      dealerDataJobBlocksManualPurchase({ status: "running", startedAt: "2026-11-20T11:00:00.000Z", updatedAt: "x" }, now),
    ).toBe(false);
    expect(
      dealerDataJobBlocksManualPurchase(
        { status: "failed", pendingRequestId: "r", nextRetryAt: "2026-11-20T12:02:00.000Z", updatedAt: "x" },
        now,
      ),
    ).toBe(true);
    expect(dealerDataJobBlocksManualPurchase({ status: "done", updatedAt: "x" }, now)).toBe(false);
  });
});
