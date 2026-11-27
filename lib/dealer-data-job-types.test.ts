import { describe, expect, it } from "vitest";

import {
  dealerDataJobMissingAi,
  DEALER_AI_MISSING_LABEL,
  DEALER_AUTO_PRODUCT_IDS,
  DEALER_DATA_MAX_AUTO_ATTEMPTS,
  DEALER_DATA_RETRY_NO_RECHARGE_HINT,
  DEALER_DATA_STALE_RUNNING_MS,
  dealerAutoFetchHasTechnicalFail,
  dealerCommentLanguageDirective,
  dealerDataRetryButtonLabel,
  dealerPaidOutcomeFromResult,
  decideDealerDataRun,
  decideDealerRefund,
  isDealerDataAutoFetchOrder,
  isDealerPaidProductSettled,
  mergeDealerPaidOutcomes,
  normalizeDealerDataJob,
  describeDealerDataJob,
  resolveDealerCommentOutputLang,
  selectDealerAutoProductsToFetch,
  shouldAutoFetchOeVinLookup,
  planDealerVinDecodeStep,
  decideDealerDataAlert,
  dealerDataAlertText,
  dealerDataListAlertLabel,
  dealerDataJobRetryDue,
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
    for (const line of ["mini", "listing_filter", "plus", "premium", "audits", "business", "provin_select", "consultation"]) {
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
    expect(decideDealerDataRun({ job: failed, vin, trigger: "cron" })).toEqual({
      run: false,
      reason: "too_many_attempts",
    });
    expect(decideDealerDataRun({ job: failed, vin, trigger: "manual" })).toEqual({ run: true });
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

  it("override bez dīlera darba atļauts tikai dīlera produktam", () => {
    expect(
      decideDealerRefund({ job: null, amountTotalCents: 1900, paid: true, override: true, dealerProduct: false }),
    ).toEqual({ allowed: false, reason: "not_dealer_product" });
    expect(
      decideDealerRefund({ job: null, amountTotalCents: 1900, paid: true, override: true, dealerProduct: true }),
    ).toEqual({ allowed: true, amountCents: 1900 });
  });

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

  it("patur settled maksas iznākumus un komentāra valodu", () => {
    const parsed = normalizeDealerDataJob(
      {
        vin: "WAUZZZ4M0JD000001",
        status: "failed",
        paidOutcomes: { oe_vin_lookup: "ok", oe_service_history: "failed" },
        commentLang: "de",
        skipTranslate: true,
        oneautoResults: { oe_vin_lookup: { ok: true, payload: { vin: "x" } } },
      },
      "cs_test_1",
    );
    expect(parsed?.paidOutcomes).toEqual({ oe_vin_lookup: "ok", oe_service_history: "failed" });
    expect(parsed?.commentLang).toBe("de");
    expect(parsed?.skipTranslate).toBe(true);
    expect(parsed?.oneautoResults?.oe_vin_lookup).toMatchObject({ ok: true });
  });
});

describe("dealer auto paid products", () => {
  it("automātika iekasē OE Service History; VIN dekodēšana tikai pēc ierakstiem", () => {
    expect(DEALER_AUTO_PRODUCT_IDS).toEqual(["oe_service_history", "oe_vin_lookup", "vin_decoder"]);
    expect(selectDealerAutoProductsToFetch({})).toEqual(["oe_service_history"]);
  });

  it("neizsauc jau settled vēsturi un VIN Lookup tikai ja ir ieraksti", () => {
    expect(selectDealerAutoProductsToFetch({ oe_service_history: "ok" })).toEqual([]);
    expect(
      selectDealerAutoProductsToFetch({ oe_vin_lookup: "ok", oe_service_history: "ok" }),
    ).toEqual([]);
    expect(selectDealerAutoProductsToFetch({ oe_service_history: "failed" })).toEqual([
      "oe_service_history",
    ]);
    expect(shouldAutoFetchOeVinLookup({ historyHasEntries: false, lookupOutcome: null })).toBe(false);
    expect(shouldAutoFetchOeVinLookup({ historyHasEntries: true, lookupOutcome: null })).toBe(true);
    expect(shouldAutoFetchOeVinLookup({ historyHasEntries: true, lookupOutcome: "ok" })).toBe(false);
    expect(shouldAutoFetchOeVinLookup({ historyHasEntries: true, lookupOutcome: "no_data" })).toBe(
      false,
    );
  });

  it("settled iznākumu nevar pārrakstīt ar failed", () => {
    expect(
      mergeDealerPaidOutcomes(
        { oe_vin_lookup: "ok", oe_service_history: "no_data" },
        { oe_vin_lookup: "failed", oe_service_history: "failed" },
      ),
    ).toEqual({ oe_vin_lookup: "ok", oe_service_history: "no_data" });
    expect(isDealerPaidProductSettled("ok")).toBe(true);
    expect(isDealerPaidProductSettled("failed")).toBe(false);
    expect(dealerPaidOutcomeFromResult({ ok: true })).toBe("ok");
    expect(dealerPaidOutcomeFromResult({ ok: false, error: "no_data" })).toBe("no_data");
    expect(dealerPaidOutcomeFromResult({ ok: false, error: "api_unavailable" })).toBe("failed");
    const noData206 = {
      success: false,
      result: null,
      error: "There is no data available for this vehicle identification number.  You have not been charged.",
    };
    expect(
      dealerPaidOutcomeFromResult({ ok: false, error: "http_206", payload: noData206 }),
    ).toBe("no_data");
    expect(
      dealerPaidOutcomeFromResult({
        ok: false,
        error: "http_206",
        payload: null,
        message: "There is no data available for this vehicle identification number. You have not been charged.",
      }),
    ).toBe("no_data");
    expect(dealerPaidOutcomeFromResult({ ok: false, error: "http_206", payload: null })).toBe("failed");
    expect(dealerAutoFetchHasTechnicalFail({ oe_vin_lookup: "ok", oe_service_history: "pending" })).toBe(
      "oe_service_history",
    );
    expect(dealerAutoFetchHasTechnicalFail({ oe_vin_lookup: "ok", oe_service_history: "no_data" })).toBeNull();
  });
});

describe("dealer comment language", () => {
  it("PRO lieto klienta valodu, RAW paliek oriģinālvalodā", () => {
    expect(
      resolveDealerCommentOutputLang({ walletProduct: "dealer_pro", reportLang: "en" }),
    ).toBe("en");
    expect(
      resolveDealerCommentOutputLang({ walletProduct: "dealer_pro", reportLang: "ru" }),
    ).toBe("ru");
    expect(resolveDealerCommentOutputLang({ walletProduct: "dealer_raw" })).toBe("source");
    expect(resolveDealerCommentOutputLang({ skipTranslate: true, walletProduct: "dealer_pro", reportLang: "de" })).toBe(
      "source",
    );
    expect(resolveDealerCommentOutputLang({})).toBe("lv");
  });

  it("direktīva paliek pie PROVIN zīmola un īsajām defisēm", () => {
    const en = dealerCommentLanguageDirective("en");
    expect(en).toMatch(/English/);
    expect(en).toMatch(/PROVIN/);
    expect(en).toMatch(/Do not present IRISS as the service brand/);
    expect(en).toMatch(/ASCII hyphen/);
    expect(en).not.toMatch(/\u2014|\u2013/);
    expect(dealerCommentLanguageDirective("source")).toMatch(/same language as the OEM/);
    expect(DEALER_DATA_RETRY_NO_RECHARGE_HINT).toMatch(/netiks izsaukti vēlreiz/);
    expect(DEALER_DATA_RETRY_NO_RECHARGE_HINT).not.toMatch(/\u2014|\u2013/);
    expect(dealerDataRetryButtonLabel(job({ status: "failed" }))).toBe("Atkārtot");
    expect(dealerDataRetryButtonLabel(job({ status: "done" }))).toBe("Ielasīt vēlreiz");
  });
});

describe("planDealerVinDecodeStep (Nils 20.11)", () => {
  it("tukša vēsture - neviens dekodēšanas produkts", () => {
    expect(planDealerVinDecodeStep({ historyHasEntries: false, lookupGaveData: false })).toBeNull();
  });
  it("vispirms OE VIN Lookup", () => {
    expect(planDealerVinDecodeStep({ historyHasEntries: true, lookupGaveData: false })).toBe("oe_vin_lookup");
  });
  it("Lookup deva datus - Decoder nepērk", () => {
    expect(
      planDealerVinDecodeStep({ historyHasEntries: true, lookupOutcome: "ok", lookupGaveData: true }),
    ).toBeNull();
  });
  it("Lookup 206 / kļūda - Decoder; Lookup otrreiz nepērk", () => {
    for (const lookupOutcome of ["no_data", "failed", "pending"] as const) {
      expect(planDealerVinDecodeStep({ historyHasEntries: true, lookupOutcome, lookupGaveData: false })).toBe(
        "vin_decoder",
      );
    }
  });
  it("Decoder jau settled - nekā vairs", () => {
    expect(
      planDealerVinDecodeStep({
        historyHasEntries: true,
        lookupOutcome: "no_data",
        lookupGaveData: false,
        decoderOutcome: "ok",
        decoderGaveData: true,
      }),
    ).toBeNull();
    expect(
      planDealerVinDecodeStep({
        historyHasEntries: true,
        lookupOutcome: "no_data",
        lookupGaveData: false,
        decoderOutcome: "no_data",
      }),
    ).toBeNull();
  });
  it("Decoder tehniska kļūda - drīkst atkārtot", () => {
    expect(
      planDealerVinDecodeStep({
        historyHasEntries: true,
        lookupOutcome: "failed",
        lookupGaveData: false,
        decoderOutcome: "failed",
      }),
    ).toBe("vin_decoder");
  });
});

describe("dealer alerts (Nils 20.11)", () => {
  const base = { status: "failed" as const, attempts: 1, error: "x" };
  it("no_vin un draft_write_failed - uzreiz; gala kļūda pēc 3 mēģinājumiem", () => {
    expect(decideDealerDataAlert({ job: { status: "no_vin", attempts: 0 } })).toBe("no_vin");
    expect(decideDealerDataAlert({ job: { ...base, error: "draft_write_failed" } })).toBe("draft_write_failed");
    expect(decideDealerDataAlert({ job: base })).toBeNull();
    expect(decideDealerDataAlert({ job: { ...base, attempts: 3 } })).toBe("failed_final");
  });
  it("viens paziņojums uz problēmu; operatora poga nepaziņo", () => {
    expect(
      decideDealerDataAlert({ job: { ...base, attempts: 3, alert: { key: "failed_final", at: "x" } } }),
    ).toBeNull();
    expect(decideDealerDataAlert({ job: { ...base, attempts: 3 }, trigger: "manual" })).toBeNull();
    expect(decideDealerDataAlert({ job: { status: "done", attempts: 3 } })).toBeNull();
  });
  it("no_data: paziņo vienreiz, ja nav atmaksāts; operatora poga nepaziņo", () => {
    const nd = { status: "no_data" as const, attempts: 1 };
    expect(decideDealerDataAlert({ job: nd, trigger: "webhook" })).toBe("no_data");
    expect(decideDealerDataAlert({ job: nd, trigger: "cron" })).toBe("no_data");
    expect(decideDealerDataAlert({ job: { ...nd, alert: { key: "no_data", at: "x" } } })).toBeNull();
    expect(decideDealerDataAlert({ job: nd, trigger: "manual" })).toBeNull();
    // Jau atmaksāts (Stripe / maks / kredīts) - nesūta.
    expect(
      decideDealerDataAlert({
        job: { ...nd, refund: { at: "x", amountCents: 2499, stripeRefundId: "wallet_wtx_1", by: "auto", reason: "r", kind: "wallet" } },
      }),
    ).toBeNull();
    // Agrāka kļūdas atzīme netraucē «datu nav» paziņojumam.
    expect(decideDealerDataAlert({ job: { ...nd, alert: { key: "failed_final", at: "x" } } })).toBe("no_data");
  });
  it("no_data teksts: VIN, summa, bez klienta datiem", () => {
    const t = dealerDataAlertText("no_data", { vin: "WAUZZZ4M0JD000001", error: "", attempts: 1 });
    expect(t.title).toBe("Dīlera dati: datu nav - VIN WAUZZZ4M0JD000001, jāatmaksā 24,99 €");
    expect(t.body).not.toMatch(/@/);
    const w = dealerDataAlertText("no_data", { vin: "WAUZZZ4M0JD000001", attempts: 1 }, { amountLabel: "19,99 €", wallet: true });
    expect(w.title).toContain("jāatmaksā 19,99 €");
    expect(w.body).toContain("makā");
  });
  it("teksti latviski, bez garās defises un bez «eksperts»", () => {
    for (const key of ["no_vin", "draft_write_failed", "failed_final", "no_data"] as const) {
      const t = dealerDataAlertText(key, { vin: "", plate: "AB1234", error: "x", attempts: 3 });
      expect(`${t.title} ${t.body}`).not.toMatch(/\u2014|\u2013|ekspert/i);
    }
  });
  it("saraksta atzīme", () => {
    expect(dealerDataListAlertLabel({ status: "no_vin", attempts: 0 })).toBe("Nav VIN");
    expect(dealerDataListAlertLabel({ status: "failed", attempts: 1, error: "http_502" })).toBeNull();
    expect(dealerDataListAlertLabel({ status: "failed", attempts: 3, error: "http_502" })).toBe(
      "Dīlera ielase: kļūda",
    );
    expect(dealerDataListAlertLabel({ status: "done", attempts: 1 })).toBeNull();
    expect(describeDealerDataJob({ ...normalizeDealerDataJob({ status: "no_vin", plate: "ab1234" }, "s")! })).toBe(
      "CSDD neatrada VIN numuram AB1234",
    );
  });
  it("nextRetryAt - cron atkārto tikai, kad laiks pienācis", () => {
    expect(dealerDataJobRetryDue({}, 1000)).toBe(true);
    expect(dealerDataJobRetryDue({ nextRetryAt: new Date(5000).toISOString() }, 1000)).toBe(false);
    expect(dealerDataJobRetryDue({ nextRetryAt: new Date(500).toISOString() }, 1000)).toBe(true);
  });
});

describe("«Ielasīts» bez AI komentāriem (BF 27.11, S6)", () => {
  const base = { status: "done" as const, attempts: 1, serviceEventCount: 20, createdAt: "2026-11-27T07:37:33.999Z" };

  it("automātikas darbs bez aiGenerated - sarkana atzīme un skaidrs iemesls", () => {
    const job = normalizeDealerDataJob({ ...base, vin: "WBAVU910X0KT03947", trigger: "webhook" }, "s")!;
    expect(dealerDataJobMissingAi(job)).toBe(true);
    expect(describeDealerDataJob(job)).toContain(DEALER_AI_MISSING_LABEL);
    expect(dealerDataListAlertLabel(job)).toBe("AI komentāri nav");
  });

  it("aiGenerated: true, manuāla pirkuma ieraksts vai vecs darbs - bez atzīmes", () => {
    expect(dealerDataJobMissingAi({ ...base, trigger: "webhook", aiGenerated: true })).toBe(false);
    expect(dealerDataJobMissingAi({ ...base, trigger: "manual" })).toBe(false);
    expect(dealerDataJobMissingAi({ ...base, trigger: "webhook", createdAt: "2026-11-10T10:00:00.000Z" })).toBe(false);
    expect(dealerDataJobMissingAi({ ...base, trigger: "webhook", serviceEventCount: 0 })).toBe(false);
    expect(dealerDataJobMissingAi({ ...base, trigger: "manual", aiGenerated: false })).toBe(true);
  });

  it("gaida AI pēc manuāla pirkuma - statuss to pasaka", () => {
    const job = normalizeDealerDataJob({ status: "pending", vin: "WBAVU910X0KT03947", serviceEventCount: 20 }, "s")!;
    expect(describeDealerDataJob(job)).toBe("Ielasīts: 20 servisa ieraksti, AI komentāri tiek ģenerēti");
  });
});
