import { describe, expect, it } from "vitest";

import {
  DEALER_DATA_MAX_AUTO_ATTEMPTS,
  DEALER_DATA_STALE_RUNNING_MS,
  decideDealerDataRun,
  decideDealerRefund,
  isDealerDataAutoFetchOrder,
  normalizeDealerDataJob,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";

function job(patch: Partial<DealerDataJob> = {}): DealerDataJob {
  const now = new Date().toISOString();
  return {
    sessionId: "cs_test_1",
    vin: "WAUZZZ4M0JD000001",
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

describe("isDealerDataAutoFetchOrder", () => {
  it("atpazīst dīlera pozīciju pēc checkout līnijas", () => {
    expect(isDealerDataAutoFetchOrder({ checkoutLine: "dealer", amountTotalCents: null })).toBe(true);
  });

  it("atpazīst dīlera cenu joslu 11-30 €", () => {
    expect(isDealerDataAutoFetchOrder({ amountTotalCents: 1100 })).toBe(true);
    expect(isDealerDataAutoFetchOrder({ amountTotalCents: 1900 })).toBe(true);
    expect(isDealerDataAutoFetchOrder({ amountTotalCents: 3000 })).toBe(true);
  });

  it("neiedarbojas uz MINI, pilno auditu un B2B paku", () => {
    expect(isDealerDataAutoFetchOrder({ amountTotalCents: 3999 })).toBe(false);
    expect(isDealerDataAutoFetchOrder({ amountTotalCents: 7999 })).toBe(false);
    expect(isDealerDataAutoFetchOrder({ amountTotalCents: 9999 })).toBe(false);
  });

  it("neiedarbojas bez summas un zem joslas", () => {
    expect(isDealerDataAutoFetchOrder({})).toBe(false);
    expect(isDealerDataAutoFetchOrder({ amountTotalCents: 500 })).toBe(false);
  });

  it("cenu josla nenostrādā uz citām līnijām, ja tās nejauši ir akcijas cenā", () => {
    for (const line of ["mini", "listing_filter", "premium", "business", "provin_select", "consultation"]) {
      expect(isDealerDataAutoFetchOrder({ checkoutLine: line, amountTotalCents: 1900 })).toBe(false);
    }
  });

  it("cenu josla strādā, ja `checkout_line` metadata trūkst", () => {
    expect(isDealerDataAutoFetchOrder({ checkoutLine: "audit", amountTotalCents: 1900 })).toBe(true);
    expect(isDealerDataAutoFetchOrder({ checkoutLine: "", amountTotalCents: 1900 })).toBe(true);
  });
});

describe("decideDealerDataRun", () => {
  const vin = "WAUZZZ4M0JD000001";

  it("palaiž, ja darba vēl nav", () => {
    expect(decideDealerDataRun({ job: null, vin })).toEqual({ run: true });
  });

  it("neatkārto ielasi tam pašam VIN, ja dati jau saņemti", () => {
    expect(decideDealerDataRun({ job: job({ status: "done" }), vin })).toEqual({
      run: false,
      reason: "already_fetched",
    });
  });

  it("neatkārto ielasi, ja API jau atbildēja, ka datu nav", () => {
    expect(decideDealerDataRun({ job: job({ status: "no_data" }), vin })).toEqual({
      run: false,
      reason: "already_fetched",
    });
  });

  it("ļauj ielasīt, ja operators VIN ir izlabojis", () => {
    expect(
      decideDealerDataRun({ job: job({ status: "done" }), vin: "WBA5A5C50ED000002" }),
    ).toEqual({ run: true });
  });

  it("nepalaiž paralēli, kamēr ielase ir svaiga", () => {
    const now = Date.now();
    const running = job({ status: "running", startedAt: new Date(now - 1000).toISOString() });
    expect(decideDealerDataRun({ job: running, vin, nowMs: now })).toEqual({
      run: false,
      reason: "in_flight",
    });
  });

  it("pārņem iestrēgušu ielasi pēc noildzes", () => {
    const now = Date.now();
    const stuck = job({
      status: "running",
      startedAt: new Date(now - DEALER_DATA_STALE_RUNNING_MS - 1000).toISOString(),
    });
    expect(decideDealerDataRun({ job: stuck, vin, nowMs: now })).toEqual({ run: true });
  });

  it("apstājas pēc atkārtotām kļūdām un gaida operatoru", () => {
    const failed = job({ status: "failed", attempts: DEALER_DATA_MAX_AUTO_ATTEMPTS });
    expect(decideDealerDataRun({ job: failed, vin })).toEqual({
      run: false,
      reason: "too_many_attempts",
    });
  });

  it("operatora `force` pārvar jau ielasītu VIN, bet ne paralēlu izpildi", () => {
    const now = Date.now();
    expect(decideDealerDataRun({ job: job({ status: "done" }), vin, force: true })).toEqual({
      run: true,
    });
    const running = job({ status: "running", startedAt: new Date(now).toISOString() });
    expect(decideDealerDataRun({ job: running, vin, force: true, nowMs: now })).toEqual({
      run: false,
      reason: "in_flight",
    });
  });

  it("bez VIN nepalaiž", () => {
    expect(decideDealerDataRun({ job: null, vin: "  " })).toEqual({
      run: false,
      reason: "vin_missing",
    });
  });
});

describe("decideDealerRefund", () => {
  const noData = job({ status: "no_data" });

  it("atļauj atmaksu, kad OEM datu nav", () => {
    expect(decideDealerRefund({ job: noData, amountTotalCents: 1900, paid: true })).toEqual({
      allowed: true,
      amountCents: 1900,
    });
  });

  it("neatļauj atmaksu par tehnisku kļūdu mūsu pusē", () => {
    const failed = job({ status: "failed", error: "insufficient_balance" });
    expect(decideDealerRefund({ job: failed, amountTotalCents: 1900, paid: true })).toEqual({
      allowed: false,
      reason: "not_no_data",
    });
  });

  it("neatļauj atmaksu, ja dati ir piegādāti", () => {
    expect(
      decideDealerRefund({ job: job({ status: "done" }), amountTotalCents: 1900, paid: true }),
    ).toEqual({ allowed: false, reason: "not_no_data" });
  });

  it("atmaksā tikai vienu reizi", () => {
    const refunded = job({
      status: "no_data",
      refund: {
        at: new Date().toISOString(),
        amountCents: 1900,
        stripeRefundId: "re_1",
        by: "admin",
        reason: "dealer_data_no_data",
      },
    });
    expect(decideDealerRefund({ job: refunded, amountTotalCents: 1900, paid: true })).toEqual({
      allowed: false,
      reason: "already_refunded",
    });
  });

  it("nepārsniedz dīlera produkta griestus", () => {
    expect(decideDealerRefund({ job: noData, amountTotalCents: 7999, paid: true })).toEqual({
      allowed: false,
      reason: "amount_above_cap",
    });
  });

  it("neatmaksā neapmaksātu pasūtījumu", () => {
    expect(decideDealerRefund({ job: noData, amountTotalCents: 1900, paid: false })).toEqual({
      allowed: false,
      reason: "not_paid",
    });
  });

  it("operatora `override` neatceļ griestus un vienreizīgumu", () => {
    expect(
      decideDealerRefund({ job: job({ status: "done" }), amountTotalCents: 1900, paid: true, override: true }),
    ).toEqual({ allowed: true, amountCents: 1900 });
    expect(
      decideDealerRefund({ job: job({ status: "done" }), amountTotalCents: 7999, paid: true, override: true }),
    ).toEqual({ allowed: false, reason: "amount_above_cap" });
  });
});

describe("normalizeDealerDataJob", () => {
  it("noraida bojātu atmaksas ierakstu, bet patur darbu", () => {
    const parsed = normalizeDealerDataJob(
      { vin: "wauzzz4m0jd000001", status: "no_data", refund: { amountCents: 0 } },
      "cs_test_1",
    );
    expect(parsed?.vin).toBe("WAUZZZ4M0JD000001");
    expect(parsed?.status).toBe("no_data");
    expect(parsed?.refund).toBeUndefined();
  });

  it("nezināmu statusu nolaiž uz `pending`, nevis met kļūdu", () => {
    expect(normalizeDealerDataJob({ status: "exploded" }, "cs_test_1")?.status).toBe("pending");
  });

  it("patur B2B kredīta atgriešanu ar 0 € un credit_ id", () => {
    const parsed = normalizeDealerDataJob(
      {
        vin: "WAUZZZ4M0JD000001",
        status: "no_data",
        refund: {
          at: "2026-09-14T10:00:00.000Z",
          amountCents: 0,
          stripeRefundId: "credit_manual_order_abc",
          kind: "credit",
        },
      },
      "manual_order_abc",
    );
    expect(parsed?.refund?.kind).toBe("credit");
    expect(parsed?.refund?.amountCents).toBe(0);
    expect(parsed?.refund?.stripeRefundId).toBe("credit_manual_order_abc");
  });
});
