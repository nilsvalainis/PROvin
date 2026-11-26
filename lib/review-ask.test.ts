import { describe, expect, it } from "vitest";

import {
  buildReviewAskEmail,
  buildReviewAskWhatsappText,
  decideReviewAsk,
  DEFAULT_REVIEW_ASK_POLICY,
  emptyReviewAskDoc,
  enqueueReviewAsk,
  GOOGLE_REVIEW_URL,
  isReviewAskDayReached,
  isReviewAskSendWindow,
  parseReviewAskDoc,
  pruneReviewAskDoc,
  REVIEW_ASK_COPY,
  reviewAskPlannedAt,
  reviewAskPolicyFromDoc,
  reviewAskStatusLine,
  reviewCarLabel,
  reviewCarObject,
  reviewIndicatorGreen,
  withReviewAsked,
  withReviewHeld,
  withReviewSkipped,
  type ReviewAskEntry,
  type ReviewAskOrderFacts,
} from "@/lib/review-ask";

// 2026-11-26 ir ceturtdiena. Rīga ziemā = UTC+2.
const THU_0900_UTC = Date.parse("2026-11-26T09:00:00Z"); // 11:00 Rīgā
const sentWed = "2026-11-25T14:00:00Z"; // trešdiena 16:00 Rīgā

const entry = (over: Partial<ReviewAskEntry> = {}): ReviewAskEntry => ({
  sessionId: "cs_test_1",
  reportSentAt: sentWed,
  email: "klients@example.com",
  lang: "lv",
  car: "VW Golf",
  vin: "WVWZZZ1KZAW000123",
  ...over,
});

const facts = (over: Partial<ReviewAskOrderFacts> = {}): ReviewAskOrderFacts => ({
  b2b: false,
  refunded: false,
  cancelled: false,
  optOut: false,
  email: "klients@example.com",
  otherAskAt: null,
  indicatorGreen: true,
  ...over,
});

describe("laiks", () => {
  it("darba dienās 10:00-18:00 Rīgā", () => {
    expect(isReviewAskSendWindow(Date.parse("2026-11-26T08:00:00Z"))).toBe(true); // 10:00
    expect(isReviewAskSendWindow(Date.parse("2026-11-26T07:59:00Z"))).toBe(false); // 09:59
    expect(isReviewAskSendWindow(Date.parse("2026-11-26T15:59:00Z"))).toBe(true); // 17:59
    expect(isReviewAskSendWindow(Date.parse("2026-11-26T16:00:00Z"))).toBe(false); // 18:00
    expect(isReviewAskSendWindow(Date.parse("2026-11-28T10:00:00Z"))).toBe(false); // sestdiena
    expect(isReviewAskSendWindow(Date.parse("2026-11-29T10:00:00Z"))).toBe(false); // svētdiena
    // Vasarā UTC+3: 07:00 UTC = 10:00 Rīgā.
    expect(isReviewAskSendWindow(Date.parse("2026-07-01T07:00:00Z"))).toBe(true);
  });

  it("nākamā kalendārā diena Rīgā, ne 24 h", () => {
    const lateEvening = "2026-11-25T21:30:00Z"; // 23:30 Rīgā trešdien
    expect(isReviewAskDayReached(lateEvening, Date.parse("2026-11-25T21:50:00Z"))).toBe(false);
    expect(isReviewAskDayReached(lateEvening, Date.parse("2026-11-25T22:10:00Z"))).toBe(true); // 00:10 ceturtdien
  });

  it("sūta nākamajā dienā darba laikā; vakarā/pirms 10:00 gaida", () => {
    const doc = emptyReviewAskDoc();
    expect(decideReviewAsk(entry(), facts(), doc, Date.parse("2026-11-25T15:00:00Z")).kind).toBe("wait"); // tā pati diena
    expect(decideReviewAsk(entry(), facts(), doc, Date.parse("2026-11-26T06:00:00Z")).kind).toBe("wait"); // 08:00
    expect(decideReviewAsk(entry(), facts(), doc, THU_0900_UTC).kind).toBe("send");
  });

  it("piektdienas atskaite - pirmdienā", () => {
    const fri = entry({ reportSentAt: "2026-11-27T12:00:00Z" });
    const doc = emptyReviewAskDoc();
    expect(decideReviewAsk(fri, facts(), doc, Date.parse("2026-11-28T10:00:00Z")).kind).toBe("wait");
    expect(decideReviewAsk(fri, facts(), doc, Date.parse("2026-11-30T08:30:00Z")).kind).toBe("send");
    expect(reviewAskStatusLine({ plannedAt: reviewAskPlannedAt(fri.reportSentAt) })).toBe("Atsauksme: plānota 30.11");
  });

  it("pārāk vēlu (>14 d.) - vairs nesūta", () => {
    const d = decideReviewAsk(entry({ reportSentAt: "2026-11-01T10:00:00Z" }), facts(), emptyReviewAskDoc(), THU_0900_UTC);
    expect(d).toEqual({ kind: "skip", reason: "too_late" });
  });
});

describe("izņēmumi", () => {
  const doc = emptyReviewAskDoc();
  it.each([
    [{ b2b: true }, "b2b"],
    [{ refunded: true }, "refunded"],
    [{ cancelled: true }, "cancelled"],
    [{ email: "" }, "no_email"],
    [{ optOut: true }, "opt_out"],
    [{ otherAskAt: "2026-11-25T10:00:00Z" }, "already_asked"],
  ] as const)("%o -> %s", (over, reason) => {
    expect(decideReviewAsk(entry(), facts(over), doc, THU_0900_UTC)).toEqual({ kind: "skip", reason });
  });

  it("klientam jau lūgts par citu pasūtījumu pēdējās 60 dienās", () => {
    const d = { ...doc, lastAskByEmail: { "klients@example.com": { at: "2026-10-20T10:00:00Z", sessionId: "cs_other" } } };
    expect(decideReviewAsk(entry(), facts({ email: "Klients@Example.com" }), d, THU_0900_UTC)).toEqual({
      kind: "skip",
      reason: "recent_other_order",
    });
    const old = { ...doc, lastAskByEmail: { "klients@example.com": { at: "2026-09-01T10:00:00Z", sessionId: "cs_other" } } };
    expect(decideReviewAsk(entry(), facts(), old, THU_0900_UTC).kind).toBe("send");
  });
});

describe("zaļais indikators", () => {
  it("iestatījums noklusēti ieslēgts; adminā izslēdzams", () => {
    expect(DEFAULT_REVIEW_ASK_POLICY.onlyGreen).toBe(true);
    expect(reviewAskPolicyFromDoc(emptyReviewAskDoc()).onlyGreen).toBe(true);
    expect(reviewAskPolicyFromDoc({ settings: { onlyGreen: false } }).onlyGreen).toBe(false);
    expect(parseReviewAskDoc({ settings: { onlyGreen: false } }).settings.onlyGreen).toBe(false);
  });

  it("nav zaļš / nav aprēķināts - nesūta un atzīmē; kļūst zaļš - sūta", () => {
    const doc = emptyReviewAskDoc();
    expect(decideReviewAsk(entry(), facts({ indicatorGreen: null }), doc, THU_0900_UTC)).toEqual({ kind: "hold", reason: "not_green" });
    expect(decideReviewAsk(entry(), facts({ indicatorGreen: false }), doc, THU_0900_UTC)).toEqual({ kind: "hold", reason: "not_green" });
    const held = withReviewHeld(entry(), "not_green");
    expect(reviewAskStatusLine({ skip: held.skip })).toBe("Atsauksme: nav lūgta (indikators nav zaļš)");
    expect(decideReviewAsk(held, facts({ indicatorGreen: true }), doc, THU_0900_UTC).kind).toBe("send");
    expect(withReviewAsked(held, "2026-11-26T09:00:00Z").skip).toBeUndefined();
    // Termiņš beidzies, joprojām nav zaļš - paliek «indikators nav zaļš».
    const late = { ...held, reportSentAt: "2026-11-01T10:00:00Z" };
    expect(decideReviewAsk(late, facts({ indicatorGreen: null }), doc, THU_0900_UTC)).toEqual({ kind: "skip", reason: "not_green" });
  });

  it("izslēgts iestatījums - indikatoru neskatās", () => {
    expect(decideReviewAsk(entry(), facts({ indicatorGreen: null }), emptyReviewAskDoc(), THU_0900_UTC, { onlyGreen: false }).kind).toBe("send");
  });

  it("dīlera «Atsauksmes iespēja» Augsta vai operatora «Zaļš»", () => {
    expect(reviewIndicatorGreen({ auditResultColor: "green" })).toBe(true);
    expect(reviewIndicatorGreen({ dealerReviewLevel: "high" })).toBe(true);
    expect(reviewIndicatorGreen({ dealerReviewLevel: "medium", auditResultColor: "orange" })).toBe(false);
    expect(reviewIndicatorGreen({})).toBe(false);
  });
});

describe("idempotence", () => {
  it("rindā ieliek tikai vienreiz (labota atskaite datumu nemaina)", () => {
    const d1 = enqueueReviewAsk(emptyReviewAskDoc(), { sessionId: "cs_1", reportSentAt: sentWed, email: "a@b.lv", lang: "lv" });
    expect(d1).not.toBeNull();
    expect(enqueueReviewAsk(d1!, { sessionId: "cs_1", reportSentAt: "2026-11-27T10:00:00Z", email: "a@b.lv", lang: "lv" })).toBeNull();
  });

  it("nosūtīts - vairs nesūta", () => {
    const sent = withReviewAsked(entry({ claimAt: "2026-11-26T09:00:00Z" }), "2026-11-26T09:00:05Z");
    expect(sent.claimAt).toBeUndefined();
    expect(decideReviewAsk(sent, facts(), emptyReviewAskDoc(), THU_0900_UTC + 86_400_000).kind).toBe("done");
  });

  it("aizņemts (otrs cron sūta) - gaida; nokavēta aizņemšana = uzskata par nosūtītu", () => {
    const claimed = entry({ claimAt: new Date(THU_0900_UTC - 60_000).toISOString() });
    expect(decideReviewAsk(claimed, facts(), emptyReviewAskDoc(), THU_0900_UTC).kind).toBe("wait");
    const stale = entry({ claimAt: new Date(THU_0900_UTC - 60 * 60_000).toISOString() });
    expect(decideReviewAsk(stale, facts(), emptyReviewAskDoc(), THU_0900_UTC)).toEqual({ kind: "skip", reason: "stale_claim" });
    const after = withReviewSkipped(stale, "stale_claim", new Date(THU_0900_UTC).toISOString());
    expect(after.askedAt).toBe(stale.claimAt);
    expect(decideReviewAsk(after, facts(), emptyReviewAskDoc(), THU_0900_UTC).kind).toBe("done");
  });

  it("prune izmet vecus pabeigtos un >60 d. e-pastus, svaigos atstāj", () => {
    const doc = {
      ...emptyReviewAskDoc(),
      entries: { a: entry({ sessionId: "a", doneAt: "2026-10-01T10:00:00Z" }), b: entry({ sessionId: "b" }) },
      lastAskByEmail: { "x@y.lv": { at: "2026-08-01T10:00:00Z", sessionId: "a" }, "z@y.lv": { at: "2026-11-20T10:00:00Z", sessionId: "b" } },
    };
    const p = pruneReviewAskDoc(doc, THU_0900_UTC);
    expect(Object.keys(p.entries)).toEqual(["b"]);
    expect(Object.keys(p.lastAskByEmail)).toEqual(["z@y.lv"]);
  });
});

describe("temats un valodas", () => {
  it("ar marku un modeli", () => {
    expect(buildReviewAskEmail({ lang: "lv", car: "VW Golf", vin: "WVWZZZ1KZAW000123" }).subject).toBe(
      "Kā Jums noderēja atskaite par VW Golf?",
    );
    expect(buildReviewAskEmail({ lang: "en", car: "VW Golf" }).subject).toBe("How useful was your report on the VW Golf?");
    expect(buildReviewAskEmail({ lang: "ru", car: "VW Golf" }).subject).toBe("Насколько полезен был отчёт по VW Golf?");
    expect(buildReviewAskEmail({ lang: "de", car: "VW Golf" }).subject).toBe("Wie hilfreich war der Bericht zum VW Golf?");
  });

  it("bez modeļa - «Jūsu auto (VIN …xxxx)»", () => {
    expect(buildReviewAskEmail({ lang: "lv", car: "", vin: "WVWZZZ1KZAW000123" }).subject).toBe(
      "Kā Jums noderēja atskaite par Jūsu auto (VIN …0123)?",
    );
    expect(buildReviewAskEmail({ lang: "en", vin: "WVWZZZ1KZAW000123" }).subject).toBe(
      "How useful was your report on your car (VIN …0123)?",
    );
    expect(buildReviewAskEmail({ lang: "de", vin: "WVWZZZ1KZAW000123" }).subject).toContain("zu Ihrem Fahrzeug (FIN …0123)");
    expect(reviewCarObject("lv", null, null)).toBe("Jūsu auto");
  });

  it("auto nosaukums no CSDD lielajiem burtiem", () => {
    expect(reviewCarLabel("VOLKSWAGEN", "GOLF")).toBe("Volkswagen Golf");
    expect(reviewCarLabel("BMW", "X5")).toBe("BMW X5");
    expect(reviewCarLabel("", "")).toBe("");
  });

  it.each(["lv", "en", "ru", "de"] as const)("%s: īss teksts, poga, paraksts PROVIN.LV, bez aizliegtā", (lang) => {
    const m = buildReviewAskEmail({ lang, car: "VW Golf" });
    expect(m.href).toBe(GOOGLE_REVIEW_URL);
    expect(m.button).toBe(REVIEW_ASK_COPY[lang].button);
    expect(m.text).toContain(GOOGLE_REVIEW_URL);
    expect(m.text.trim().endsWith("PROVIN.LV")).toBe(true);
    const sentences = m.body.split(/[.!?](?:\s|$)/).filter((x) => x.trim());
    expect(sentences.length).toBeLessThanOrEqual(3);
    const all = `${m.subject}\n${m.text}\n${buildReviewAskWhatsappText({ lang, car: "VW Golf" })}`;
    expect(all).not.toMatch(/[—–]/);
    expect(all).not.toMatch(/Nils|eksperts|5 zvaigz|five stars|5 звезд|5 Sterne|atlīdz|bonus|discount|atlaide|скидк|Rabatt/i);
    expect(all).not.toMatch(/būšu|pateicīgs\b/);
  });

  it("WhatsApp - saite atsevišķā rindā", () => {
    const t = buildReviewAskWhatsappText({ lang: "lv", car: "VW Golf" });
    expect(t.split("\n")).toContain(GOOGLE_REVIEW_URL);
    expect(t).toContain("PROVIN atskaite par VW Golf noderēja");
  });
});
