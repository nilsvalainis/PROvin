import { describe, expect, it } from "vitest";

import { shouldShowDealerRefundButton } from "@/lib/admin-dealer-data-refund";
import { adminIngestFromDealerJob } from "@/lib/admin-mobile-ingest";
import { dealerDataJobBelongsInSweepIndex, mergeDealerDataJobPatch } from "@/lib/dealer-data-job-merge";
import {
  DEALER_UPSTREAM_DOWN_ERROR,
  DEALER_UPSTREAM_DOWN_LABEL,
  DEALER_UPSTREAM_MAX_RETRIES,
  dealerDataAlertText,
  dealerDataJobSuggestsRefund,
  dealerDataJobUpstreamDown,
  dealerDataJobWaitsForUpstream,
  dealerDataListAlertLabel,
  dealerDataRetryButtonLabel,
  decideDealerDataAlert,
  decideDealerDataRun,
  describeDealerDataJob,
  isOneautoTransientUpstreamFailure,
  normalizeDealerDataJob,
  planDealerUpstreamRetry,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";

/** Nils 27.11: WBAMX31060C796522 - OneAuto oe_service_history 502, adminā «Kļūda: upstream_error». */
const VIN = "WBAMX31060C796522";
const T0 = Date.parse("2026-11-27T18:10:00.000Z");

function job(patch: Partial<DealerDataJob> = {}): DealerDataJob {
  return {
    sessionId: "cs_test_upstream",
    vin: VIN,
    status: "pending",
    attempts: 0,
    createdAt: "2026-11-27T18:00:00.000Z",
    updatedAt: "2026-11-27T18:10:00.000Z",
    ...patch,
  };
}

describe("isOneautoTransientUpstreamFailure", () => {
  it("5xx / upstream_error / api_unavailable / taimauts / tīkls - pārejoši", () => {
    expect(isOneautoTransientUpstreamFailure({ error: "upstream_error", httpStatus: 502 })).toBe(true);
    expect(isOneautoTransientUpstreamFailure({ error: "upstream_error" })).toBe(true);
    expect(isOneautoTransientUpstreamFailure({ error: "api_unavailable" })).toBe(true);
    expect(isOneautoTransientUpstreamFailure({ error: "http_503" })).toBe(true);
    expect(isOneautoTransientUpstreamFailure({ error: "something", httpStatus: 504 })).toBe(true);
    expect(isOneautoTransientUpstreamFailure({ error: "The operation was aborted due to timeout" })).toBe(true);
    expect(isOneautoTransientUpstreamFailure({ error: "fetch failed" })).toBe(true);
    expect(isOneautoTransientUpstreamFailure({ error: "network_error" })).toBe(true);
  });

  it("atbildes par datiem / kontu nav pārejošas", () => {
    for (const error of ["no_data", "pending", "http_206", "insufficient_balance", "invalid_vin", "unauthorized_upstream", "service_not_enabled"]) {
      expect(isOneautoTransientUpstreamFailure({ error })).toBe(false);
    }
    expect(isOneautoTransientUpstreamFailure({ error: "insufficient_balance", httpStatus: 402 })).toBe(false);
    expect(isOneautoTransientUpstreamFailure(null)).toBe(false);
  });
});

describe("planDealerUpstreamRetry", () => {
  it("10 min, 30 min, 2 h, tad upstream_down", () => {
    expect(planDealerUpstreamRetry(0, T0)).toEqual({
      status: "retry_wait",
      upstreamRetries: 1,
      nextRetryAt: new Date(T0 + 10 * 60_000).toISOString(),
    });
    expect(planDealerUpstreamRetry(1, T0)).toMatchObject({ upstreamRetries: 2, nextRetryAt: new Date(T0 + 30 * 60_000).toISOString() });
    expect(planDealerUpstreamRetry(2, T0)).toMatchObject({ upstreamRetries: 3, nextRetryAt: new Date(T0 + 120 * 60_000).toISOString() });
    expect(planDealerUpstreamRetry(3, T0)).toEqual({ status: "failed", upstreamRetries: 3, error: DEALER_UPSTREAM_DOWN_ERROR });
    expect(DEALER_UPSTREAM_MAX_RETRIES).toBe(3);
  });
});

describe("retry_wait adminā", () => {
  const waiting = job({
    status: "retry_wait",
    error: "upstream_error",
    upstreamRetries: 1,
    // 18:20 UTC = 20:20 Rīgā (ziema, UTC+2)
    nextRetryAt: "2026-11-27T18:20:00.000Z",
  });

  it("skaidrs teksts ar Rīgas laiku un n/3, nevis «Kļūda: upstream_error»", () => {
    expect(describeDealerDataJob(waiting)).toBe("OneAuto serveris neatbild - automātiski mēģinās vēlreiz 20:20 (1/3)");
    expect(describeDealerDataJob({ ...waiting, upstreamRetries: 3 })).toContain("(3/3)");
  });

  it("nav atmaksas ieteikuma, nav sarkanās atzīmes, nav paziņojuma", () => {
    expect(dealerDataJobSuggestsRefund(waiting)).toBe(false);
    expect(shouldShowDealerRefundButton({ canRefund: true, job: waiting })).toBe(false);
    expect(dealerDataListAlertLabel(waiting)).toBeNull();
    expect(decideDealerDataAlert({ job: { ...waiting, attempts: 5 }, trigger: "cron" })).toBeNull();
    expect(dealerDataJobWaitsForUpstream(waiting)).toBe(true);
    expect(dealerDataRetryButtonLabel(waiting)).toBe("Atkārtot");
  });

  it("telefona saraksts: «Gaida OneAuto» (nav sarkans)", () => {
    expect(adminIngestFromDealerJob(waiting)).toMatchObject({ state: "running", label: "Gaida OneAuto" });
  });

  it("paliek cron indeksā; cron drīkst palaist (nav too_many_attempts)", () => {
    expect(dealerDataJobBelongsInSweepIndex(waiting)).toBe(true);
    expect(decideDealerDataRun({ job: { ...waiting, attempts: 3 }, vin: VIN, trigger: "cron" })).toEqual({ run: true });
  });

  it("normalizācija saglabā statusu un skaitītāju", () => {
    const n = normalizeDealerDataJob(JSON.parse(JSON.stringify(waiting)), waiting.sessionId);
    expect(n).toMatchObject({ status: "retry_wait", upstreamRetries: 1, nextRetryAt: waiting.nextRetryAt });
  });
});

describe("upstream_down (pēc 3 atkārtojumiem)", () => {
  const down = job({ status: "failed", error: DEALER_UPSTREAM_DOWN_ERROR, attempts: 3, upstreamRetries: 3 });

  it("oranžais teksts «spied Atkārtot vēlāk»; atmaksa netiek piedāvāta", () => {
    expect(dealerDataJobUpstreamDown(down)).toBe(true);
    expect(describeDealerDataJob(down)).toBe(DEALER_UPSTREAM_DOWN_LABEL);
    expect(DEALER_UPSTREAM_DOWN_LABEL).toBe("OneAuto serveris nestrādā - spied «Atkārtot» vēlāk");
    expect(shouldShowDealerRefundButton({ canRefund: true, job: down })).toBe(false);
    expect(dealerDataJobSuggestsRefund(down)).toBe(false);
    expect(dealerDataListAlertLabel(down)).toBe("OneAuto nestrādā");
    expect(adminIngestFromDealerJob(down)).toMatchObject({ state: "idle", label: "OneAuto nestrādā" });
  });

  it("cron neatkārto; operatora poga drīkst", () => {
    expect(decideDealerDataRun({ job: down, vin: VIN, trigger: "cron" })).toEqual({ run: false, reason: "too_many_attempts" });
    expect(decideDealerDataRun({ job: down, vin: VIN, trigger: "manual" })).toEqual({ run: true });
  });

  it("viens admina paziņojums ar skaidru tekstu (bez atmaksas)", () => {
    expect(decideDealerDataAlert({ job: down, trigger: "cron" })).toBe("failed_final");
    const t = dealerDataAlertText("failed_final", down);
    expect(t.title).toBe("Dīlera dati: OneAuto serveris nestrādā");
    expect(t.body).toContain("Spied «Atkārtot» vēlāk");
    expect(t.body).toContain("Atmaksa nav vajadzīga");
    expect(t.body).not.toMatch(/[—–]/);
  });

  it("parasta gala kļūda joprojām sarkana ar atmaksas pogu", () => {
    const failed = job({ status: "failed", error: "insufficient_balance", attempts: 3 });
    expect(shouldShowDealerRefundButton({ canRefund: true, job: failed })).toBe(true);
    expect(describeDealerDataJob(failed)).toBe("Kļūda: insufficient_balance");
  });
});

describe("mergeDealerDataJobPatch upstreamRetries", () => {
  it("saglabājas skrienot, notīrās pēc done", () => {
    const base = job({ status: "retry_wait", upstreamRetries: 2, nextRetryAt: "2026-11-27T18:40:00.000Z" });
    const running = mergeDealerDataJobPatch(base.sessionId, base, { vin: VIN, status: "running" });
    expect(running.upstreamRetries).toBe(2);
    const done = mergeDealerDataJobPatch(base.sessionId, running, { vin: VIN, status: "done" });
    expect(done.upstreamRetries).toBeUndefined();
    const reset = mergeDealerDataJobPatch(base.sessionId, base, { vin: VIN, upstreamRetries: 0 });
    expect(reset.upstreamRetries).toBeUndefined();
  });
});
