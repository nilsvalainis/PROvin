import { describe, expect, it } from "vitest";

import {
  CSDD_PAID_POLL_TOTAL_MS,
  csddPaidAutoB2bEnabled,
  csddPaidAutoDailyMax,
  csddPaidAutoEnabled,
  csddPaidAutoIsDemo,
  csddPaidAutoJobOpen,
  csddPaidAutoPlate,
  csddPaidAutoProductEligible,
  csddPaidAutoProductKind,
  csddPaidAutoStatusLv,
  decideCsddPaidAutoAction,
  isRigaNight,
  nextRigaDayMorning,
  nextRigaMorning,
  normalizeCsddPaidAutoJob,
  rigaDayKey,
  type CsddPaidAutoJob,
} from "@/lib/csdd-paid-auto-logic";

// 23.11.2026 ziema: Rīga = UTC+2.
const at = (riga: string) => Date.parse(`${riga}+02:00`);
const job = (p: Partial<CsddPaidAutoJob> = {}): CsddPaidAutoJob => ({
  sessionId: "cs_test_abc",
  plate: "RO8544",
  state: "queued",
  createdAt: "2026-11-23T08:00:00.000Z",
  updatedAt: "2026-11-23T08:00:00.000Z",
  ...p,
});
const limits = { dailyCount: 0, dailyMax: 10 };

describe("produkta filtrs", () => {
  it("AUDITS (audit/premium) un PROVIN Business", () => {
    expect(csddPaidAutoProductEligible({ checkoutLine: "audit" })).toBe(true);
    expect(csddPaidAutoProductEligible({ checkoutLine: "premium" })).toBe(true);
    expect(csddPaidAutoProductKind({ checkoutLine: "audit" })).toBe("audit");
    expect(csddPaidAutoProductKind({ checkoutLine: "business" })).toBe("b2b");
    for (const line of ["dealer", "mini", "plus", "provin_select", "consultation"]) {
      expect(csddPaidAutoProductEligible({ checkoutLine: line })).toBe(false);
    }
  });
  it("NE dīlera dati pēc summas, NE Telegram, NE B2B paka / maks", () => {
    expect(csddPaidAutoProductEligible({ checkoutLine: "audit", isDealerData: true })).toBe(false);
    expect(csddPaidAutoProductEligible({ checkoutLine: "audit", isTelegram: true })).toBe(false);
    expect(csddPaidAutoProductEligible({ checkoutLine: "audit", fulfillment: "b2b_pack" })).toBe(false);
    expect(csddPaidAutoProductEligible({ checkoutLine: "audit", fulfillment: "b2b_wallet_topup" })).toBe(false);
    expect(csddPaidAutoProductEligible({ checkoutLine: "audit", fulfillment: "order_upsell" })).toBe(false);
    expect(csddPaidAutoProductEligible({ checkoutLine: "audit", fulfillment: "client_link" })).toBe(true);
    expect(csddPaidAutoProductKind({ checkoutLine: "business", fulfillment: "business_link" })).toBe("b2b");
    expect(csddPaidAutoProductEligible({ checkoutLine: "business", fulfillment: "b2b_pack" })).toBe(false);
    expect(csddPaidAutoProductEligible({ checkoutLine: "business", fulfillment: "business_link", isDealerData: true })).toBe(false);
  });
  it("B2B partnera konts: tikai Business, ne dīlera dati", () => {
    expect(csddPaidAutoProductKind({ checkoutLine: "business", channel: "b2b_partner" })).toBe("b2b");
    expect(csddPaidAutoProductKind({ checkoutLine: "dealer", channel: "b2b_partner" })).toBeNull();
    expect(csddPaidAutoProductKind({ checkoutLine: "audit", channel: "b2b_partner" })).toBeNull();
  });
  it("demo / testa pasūtījumi naudu netērē", () => {
    expect(csddPaidAutoIsDemo("cs_live_abc")).toBe(false);
    expect(csddPaidAutoIsDemo("manual_order_20261124_abc")).toBe(false);
    expect(csddPaidAutoIsDemo("cs_live_abc", { livemode: false })).toBe(true);
    expect(csddPaidAutoIsDemo("cs_live_abc", { isDemo: true })).toBe(true);
    expect(csddPaidAutoIsDemo("demo_order_exp_1")).toBe(true);
    expect(csddPaidAutoIsDemo("ord_abc123")).toBe(true);
    expect(csddPaidAutoIsDemo("")).toBe(true);
  });
});

describe("numurzīme", () => {
  it("CSDD reģistra numurs (arī personalizēts) vai LV formāta ievadītais", () => {
    expect(csddPaidAutoPlate({ registryPlate: "ro 8544" })).toBe("RO8544");
    expect(csddPaidAutoPlate({ registryPlate: "MANTAS" })).toBe("MANTAS");
    expect(csddPaidAutoPlate({ enteredPlates: ["ro-8544"] })).toBe("RO8544");
  });
  it("VIN vai ārzemju numurs neder", () => {
    expect(csddPaidAutoPlate({ enteredPlates: ["WBA5R1C0XLFH42873"] })).toBeNull();
    expect(csddPaidAutoPlate({ enteredPlates: ["B123XYZ", "", null] })).toBeNull();
    expect(csddPaidAutoPlate({})).toBeNull();
  });
});

describe("env", () => {
  it("noklusējums izslēgts, griesti 10", () => {
    expect(csddPaidAutoEnabled({})).toBe(false);
    expect(csddPaidAutoEnabled({ CSDD_PAID_AUTO_ENABLED: "1" })).toBe(true);
    // B2B iet kopā ar galveno slēdzi; atsevišķi tikai izslēdzams.
    expect(csddPaidAutoB2bEnabled({})).toBe(true);
    expect(csddPaidAutoB2bEnabled({ CSDD_PAID_AUTO_B2B_ENABLED: "0" })).toBe(false);
    expect(csddPaidAutoB2bEnabled({ CSDD_PAID_AUTO_B2B_ENABLED: "off" })).toBe(false);
    expect(csddPaidAutoDailyMax({})).toBe(10);
    expect(csddPaidAutoDailyMax({ CSDD_PAID_AUTO_DAILY_MAX: "3" })).toBe(3);
    expect(csddPaidAutoDailyMax({ CSDD_PAID_AUTO_DAILY_MAX: "0" })).toBe(0);
    expect(csddPaidAutoDailyMax({ CSDD_PAID_AUTO_DAILY_MAX: "x" })).toBe(10);
  });
});

describe("nakts Rīgā 23:00-07:30", () => {
  it("robežas", () => {
    expect(isRigaNight(at("2026-11-23T22:59:00"))).toBe(false);
    expect(isRigaNight(at("2026-11-23T23:00:00"))).toBe(true);
    expect(isRigaNight(at("2026-11-24T03:00:00"))).toBe(true);
    expect(isRigaNight(at("2026-11-24T07:29:00"))).toBe(true);
    expect(isRigaNight(at("2026-11-24T07:30:00"))).toBe(false);
  });
  it("vasaras laikā (UTC+3) tas pats Rīgas pulkstenis", () => {
    expect(isRigaNight(Date.parse("2026-07-01T04:29:00Z"))).toBe(true); // 07:29 Rīgā
    expect(isRigaNight(Date.parse("2026-07-01T04:30:00Z"))).toBe(false);
  });
  it("nākamais rīts 07:30", () => {
    expect(new Date(nextRigaMorning(at("2026-11-23T23:40:00"))).toISOString()).toBe(new Date(at("2026-11-24T07:30:00")).toISOString());
    expect(new Date(nextRigaMorning(at("2026-11-24T02:03:00"))).toISOString()).toBe(new Date(at("2026-11-24T07:30:00")).toISOString());
  });
  it("griesti -> nākamās dienas rīts", () => {
    expect(new Date(nextRigaDayMorning(at("2026-11-23T14:00:00"))).toISOString()).toBe(new Date(at("2026-11-24T07:30:00")).toISOString());
    expect(rigaDayKey(at("2026-11-23T23:30:00"))).toBe("2026-11-23");
    expect(rigaDayKey(at("2026-11-24T00:30:00"))).toBe("2026-11-24");
  });
});

describe("lēmums", () => {
  it("dienā, zem griestiem -> SMS", () => {
    expect(decideCsddPaidAutoAction(job(), at("2026-11-23T10:00:00"), limits).kind).toBe("request_sms");
  });
  it("naktī -> atliek uz rītu (SMS nesūta)", () => {
    const a = decideCsddPaidAutoAction(job(), at("2026-11-23T23:30:00"), limits);
    expect(a).toEqual({ kind: "defer", reason: "night", until: at("2026-11-24T07:30:00") });
  });
  it("griesti sasniegti -> rīt", () => {
    const a = decideCsddPaidAutoAction(job(), at("2026-11-23T10:00:00"), { dailyCount: 10, dailyMax: 10 });
    expect(a.kind).toBe("defer");
    if (a.kind === "defer") expect(a.reason).toBe("daily_cap");
    expect(decideCsddPaidAutoAction(job(), at("2026-11-23T10:00:00"), { dailyCount: 0, dailyMax: 0 }).kind).toBe("defer");
  });
  it("atlikts darbs gaida līdz nextAttemptAt", () => {
    const a = decideCsddPaidAutoAction(job({ nextAttemptAt: new Date(at("2026-11-24T07:30:00")).toISOString() }), at("2026-11-24T07:00:00"), limits);
    expect(a.kind).toBe("wait");
  });
  it("idempotence: ja SMS sūtīšana jau sākta, otrreiz nesūta - tikai gaida izziņu", () => {
    const a = decideCsddPaidAutoAction(job({ smsStartedAt: "2026-11-23T08:01:00.000Z" }), at("2026-11-23T10:00:00"), limits);
    expect(a.kind).toBe("poll");
  });
  it("aizņemta noma -> gaida", () => {
    const now = at("2026-11-23T10:00:00");
    expect(decideCsddPaidAutoAction(job({ leaseUntil: new Date(now + 30_000).toISOString() }), now, limits).kind).toBe("wait");
  });
  it("aptauja ik 30 s, pēc 30 min -> gaida apmaksu", () => {
    const sent = at("2026-11-23T10:00:00");
    const j = job({ state: "sms_sent", smsSentAt: new Date(sent).toISOString(), pollStartedAt: new Date(sent).toISOString() });
    expect(decideCsddPaidAutoAction(j, sent + 1000, limits).kind).toBe("poll");
    const polled = { ...j, lastPollAt: new Date(sent + 1000).toISOString() };
    expect(decideCsddPaidAutoAction(polled, sent + 10_000, limits).kind).toBe("wait");
    expect(decideCsddPaidAutoAction(polled, sent + 31_000, limits).kind).toBe("poll");
    expect(decideCsddPaidAutoAction(polled, sent + CSDD_PAID_POLL_TOTAL_MS + 1, limits).kind).toBe("expire");
  });
  it("naktī aptauja turpinās (SMS jau nosūtīta pirms 23:00)", () => {
    const sent = at("2026-11-23T22:55:00");
    const j = job({ state: "sms_sent", smsSentAt: new Date(sent).toISOString(), lastPollAt: new Date(sent).toISOString() });
    expect(decideCsddPaidAutoAction(j, at("2026-11-23T23:10:00"), limits).kind).toBe("poll");
  });
  it("atrasts bet nav ielasīts -> apply; gala stāvokļi -> nekas", () => {
    expect(decideCsddPaidAutoAction(job({ state: "found", rawText: "x" }), Date.now(), limits).kind).toBe("apply");
    expect(decideCsddPaidAutoAction(job({ state: "found", rawText: "x", appliedAt: "t" }), Date.now(), limits).kind).toBe("none");
    expect(decideCsddPaidAutoAction(job({ state: "awaiting_payment" }), Date.now(), limits).kind).toBe("none");
    expect(decideCsddPaidAutoAction(job({ state: "error" }), Date.now(), limits).kind).toBe("none");
  });
});

describe("statuss un normalizācija", () => {
  it("atvērtie darbi", () => {
    expect(csddPaidAutoJobOpen(job())).toBe(true);
    expect(csddPaidAutoJobOpen(job({ state: "sms_sent" }))).toBe(true);
    expect(csddPaidAutoJobOpen(job({ state: "awaiting_payment" }))).toBe(false);
    expect(csddPaidAutoJobOpen(job({ state: "found", rawText: "x" }))).toBe(true);
    expect(csddPaidAutoJobOpen(job({ state: "found", rawText: "x", appliedAt: "t" }))).toBe(false);
    expect(csddPaidAutoJobOpen(job({ state: "no_plate", plate: "" }))).toBe(false);
    expect(decideCsddPaidAutoAction(job({ state: "no_plate", plate: "" }), at("2026-11-23T10:00:00"), limits).kind).toBe("none");
  });
  it("teksti latviski", () => {
    expect(csddPaidAutoStatusLv(job({ state: "awaiting_payment" }))).toBe("gaida apmaksu");
    expect(csddPaidAutoStatusLv(job({ state: "no_plate", plate: "" }))).toBe("nav LV numura");
    expect(csddPaidAutoStatusLv(job({ deferReason: "night" }))).toContain("naktī");
    expect(csddPaidAutoStatusLv(job({ state: "found", appliedAt: "t" }))).toContain("ielasīta");
  });
  it("bojāts ieraksts -> null", () => {
    expect(normalizeCsddPaidAutoJob({ state: "x", plate: "RO8544" }, "s")).toBeNull();
    expect(normalizeCsddPaidAutoJob({ state: "queued" }, "s")).toBeNull();
    expect(normalizeCsddPaidAutoJob({ state: "no_plate", product: "b2b" }, "s")).toMatchObject({ state: "no_plate", plate: "", product: "b2b" });
    expect(normalizeCsddPaidAutoJob({ state: "queued", plate: "ro8544", polls: 2 }, "s")?.plate).toBe("RO8544");
  });
});
