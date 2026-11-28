import { describe, expect, it } from "vitest";
import {
  auditSendReviewDecision,
  auditSendReviewDefault,
  AUDIT_SEND_CHECKS_EMPTY,
  auditSendBlockedReason,
  auditSendChecksAfterPdfChange,
  auditSendInitialLang,
  auditSendLangOptions,
  auditSendTemplateId,
  buildAuditSendMessage,
  isAuditSendB2b,
} from "@/lib/audits-send-message";
import { AUDITS_SEND_TEMPLATE_DEFS } from "@/lib/messages/audits-send-template-defs";
import { messageTemplatesDocFromOverrides } from "@/lib/messages/shared-block-vars";
import { auditSendRecordFromInput, auditSendStatusLine, parseOrderClientMarks, withAuditSend } from "@/lib/order-client-marks";

const VIN = "WAUZZZ4G7FN012345";
const CAR = "Audi A6 Avant 3.0 TDI";
const LANGS = ["lv", "en", "ru", "de"] as const;
// B2B tekstos nedrīkst būt mārketings, partnera / produkta nosaukumi, saites, atsauksmes vai rēķins.
const B2B_FORBIDDEN = /PROVIN\.LV|AUDITS|provin\.lv|https?:\/\/|g\.page|Google|rēķin|invoice|счёт|Rechnung|konsult|Nils|IRISS|Auto Partneris/i;

describe("AUDITS sūtīšanas ziņa (makets 27.11)", () => {
  it("B2C «Gatava» LV - temats un teksts kā maketā, paraksts PROVIN.LV", () => {
    const m = buildAuditSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, car: CAR, lang: "lv" });
    expect(m.subject).toBe(`PROVIN.LV · AUDITS atskaite gatava · ${VIN}`);
    expect(m.text).toBe(
      `Labdien!\n\nJūsu PROVIN AUDITS atskaite auto ${CAR} (VIN ${VIN}) ir gatava - PDF un pielikumi šajā e-pastā.\n\nJa ir jautājumi, vienkārši atbildiet uz šo e-pastu.\n\nAr cieņu,\nPROVIN.LV`,
    );
  });

  it("B2C «Labota versija» LV", () => {
    const m = buildAuditSendMessage({ channel: "email", situation: "fixed", b2b: false, vin: VIN, car: CAR, lang: "lv" });
    expect(m.subject).toBe(`PROVIN.LV · AUDITS atskaite - labota versija · ${VIN}`);
    expect(m.text).toContain("labotu versiju auto Audi A6 Avant 3.0 TDI");
    expect(m.text).toContain("iepriekšējā vairs nav aktuāla");
  });

  it("bez auto nosaukuma un VIN - teksts bez tukšām iekavām", () => {
    const m = buildAuditSendMessage({ channel: "email", situation: "ready", b2b: false, vin: "", car: "", lang: "lv" });
    expect(m.subject).toBe("PROVIN.LV · AUDITS atskaite gatava");
    expect(m.text).toContain("Jūsu PROVIN AUDITS atskaite ir gatava");
    expect(m.text).not.toMatch(/\(\s*\)|auto\s+\(/);
  });

  it("B2B diskrēts: «Transportlīdzekļa pārbaude», tikai PROVIN, bez auto nosaukuma, bez mārketinga - visās valodās", () => {
    const lv = buildAuditSendMessage({ channel: "email", situation: "ready", b2b: true, vin: VIN, car: CAR, lang: "lv" });
    expect(lv.subject).toBe(`Transportlīdzekļa pārbaude · ${VIN}`);
    expect(lv.text).toContain("Jautājumi - atbildiet uz šo e-pastu.");
    expect(lv.text.endsWith("Ar cieņu,\nPROVIN")).toBe(true);
    for (const lang of LANGS) {
      for (const situation of ["ready", "fixed"] as const) {
        for (const channel of ["email", "whatsapp"] as const) {
          const m = buildAuditSendMessage({ channel, situation, b2b: true, vin: VIN, car: CAR, lang });
          const all = `${m.subject ?? ""}\n${m.text}`;
          expect(all, `${lang} ${situation} ${channel}`).not.toMatch(B2B_FORBIDDEN);
          expect(all).not.toContain(CAR);
          expect(m.text.trim().split("\n").pop()).toBe("PROVIN");
        }
      }
    }
    expect(buildAuditSendMessage({ channel: "email", situation: "ready", b2b: true, vin: VIN, lang: "de" }).subject).toBe(
      `Fahrzeugprüfung · ${VIN}`,
    );
  });

  it("B2B: admina LV pārraksts ar «PROVIN.LV» / «Nils» paraksts kļūst «PROVIN»", () => {
    const doc = messageTemplatesDocFromOverrides({
      "email.audits_send.b2b_ready": { subject: "PROVIN.LV · Pārbaude", body: "Labdien!\n\nTeksts.\n\nAr cieņu,\nNils\nPROVIN.LV" },
    });
    const m = buildAuditSendMessage({ channel: "email", situation: "ready", b2b: true, vin: VIN, lang: "lv", doc });
    expect(m.subject).toBe("PROVIN · Pārbaude");
    expect(m.text).toBe("Labdien!\n\nTeksts.\n\nAr cieņu,\nPROVIN");
  });

  it("valoda: ne-LV tekstā nav latviešu vārdu; WhatsApp bez temata un bez «Ar cieņu»", () => {
    for (const lang of ["en", "ru", "de"] as const) {
      for (const b2b of [false, true]) {
        const m = buildAuditSendMessage({ channel: "email", situation: "ready", b2b, vin: VIN, car: CAR, lang });
        expect(`${m.subject}\n${m.text}`, lang).not.toMatch(/[āēīūčšžģķļņ]|Labdien|Jūsu|Ar cieņu/);
      }
    }
    const wa = buildAuditSendMessage({ channel: "whatsapp", situation: "ready", b2b: false, vin: VIN, car: CAR, lang: "lv" });
    expect(wa.subject).toBeUndefined();
    expect(wa.text).toContain("PDF pievienojam zemāk");
    expect(wa.text).toContain("rakstiet šeit");
    expect(wa.text).not.toContain("Ar cieņu");
  });

  it("šablonu ID un reģistrs: 8 šabloni, e-pastiem temats", () => {
    expect(auditSendTemplateId("email", "fixed", true)).toBe("email.audits_send.b2b_fixed");
    expect(auditSendTemplateId("whatsapp", "ready", false)).toBe("wa.audits_send.ready");
    expect(AUDITS_SEND_TEMPLATE_DEFS).toHaveLength(8);
    for (const d of AUDITS_SEND_TEMPLATE_DEFS) expect(Boolean(d.subject)).toBe(d.channel === "email");
  });
});

describe("B2B noteikšana un valoda", () => {
  it("partneris / paraugs / saņēmējs partneris = B2B; parasts klients - nē", () => {
    expect(isAuditSendB2b({ notes: "", partnerId: "p_1" })).toBe(true);
    expect(isAuditSendB2b({ isDemo: true })).toBe(true);
    expect(isAuditSendB2b({ recipientRole: "partner" })).toBe(true);
    expect(isAuditSendB2b({ notes: "", recipientRole: "client", isDemo: false })).toBe(false);
  });

  it("valodu izvēle: B2C LV/EN/RU, B2B + DE; partnera valoda bloķēta pēc noklusējuma", () => {
    expect(auditSendLangOptions(false)).toEqual(["lv", "en", "ru"]);
    expect(auditSendLangOptions(true)).toEqual(["lv", "en", "ru", "de"]);
    expect(auditSendInitialLang({ b2b: true, orderLang: "lv", lockedLang: "de" })).toBe("de");
    expect(auditSendInitialLang({ b2b: false, orderLang: "de" })).toBe("lv");
    expect(auditSendInitialLang({ b2b: false, orderLang: "ru" })).toBe("ru");
  });
});

describe("kontrolsaraksts (13.11 LAW) bloķē sūtīšanu", () => {
  const base = { busy: false, channel: "email" as const, email: "a@b.lv", subject: "S", text: "T" };
  it("līdz visi 4 punkti atzīmēti - «Sūtīt» neaktīva", () => {
    expect(auditSendBlockedReason({ ...base, checks: AUDIT_SEND_CHECKS_EMPTY })).toBe("Pārbaude 0 / 4");
    expect(auditSendBlockedReason({ ...base, checks: [true, true, true, false] })).toBe("Pārbaude 3 / 4");
    expect(auditSendBlockedReason({ ...base, checks: [true, true, true, true] })).toBeNull();
  });
  it("arī ar atzīmēm: bez e-pasta / temata / teksta vai darbības laikā - neaktīva", () => {
    const all = [true, true, true, true] as const;
    expect(auditSendBlockedReason({ ...base, checks: all, email: "" })).toMatch(/Nav klienta e-pasta/);
    expect(auditSendBlockedReason({ ...base, checks: all, subject: " " })).toBe("Temats ir tukšs.");
    expect(auditSendBlockedReason({ ...base, checks: all, text: "" })).toBe("Teksts ir tukšs.");
    expect(auditSendBlockedReason({ ...base, checks: all, busy: true })).not.toBeNull();
    expect(auditSendBlockedReason({ ...base, checks: all, channel: "whatsapp", email: "", subject: "" })).toBeNull();
  });
  it("PDF maiņa (valoda / situācija / atjaunot) noņem «Jaunākais fails» atzīmi", () => {
    expect(auditSendChecksAfterPdfChange([true, true, true, true])).toEqual([false, true, true, true]);
  });
});

describe("auditSend žurnāls", () => {
  it("ieraksts, parsēšana un statusa rinda; B2B bez konsultācijas", () => {
    const rec = auditSendRecordFromInput(
      { situation: "fixed", consult: true },
      { channel: "email", atIso: "2026-11-27T12:32:00.000Z", lang: "de", b2b: true, version: 2, files: [{ name: "a.pdf", bytes: 10 }] },
    );
    expect(rec).toEqual({
      at: "2026-11-27T12:32:00.000Z",
      channel: "email",
      situation: "fixed",
      b2b: true,
      lang: "de",
      consult: false,
      version: 2,
      files: [{ name: "a.pdf", bytes: 10 }],
    });
    const marks = parseOrderClientMarks(JSON.parse(JSON.stringify(withAuditSend({}, rec))));
    expect(marks.auditSends).toEqual([rec]);
    expect(marks.dealerSends).toBeUndefined();
    expect(auditSendStatusLine(rec)).toBe("Nosūtīts: 27.11.2026 14:32 (Labota versija, e-pasts, DE, B2B, versija 2, +1 fails)");
  });
  it("nederīgi ieraksti tiek izmesti; nezināma situācija -> «Gatava»", () => {
    expect(parseOrderClientMarks({ auditSends: [{ at: "x", channel: "fax", situation: "ready" }] }).auditSends).toBeUndefined();
    expect(auditSendRecordFromInput({ situation: "??" }, { channel: "whatsapp", atIso: "t", lang: "lv", b2b: false }).situation).toBe(
      "ready",
    );
  });
});


describe("AUDITS Google atsauksmes lūgums (Nils 28.11)", () => {
  it("noklusējums: B2C ieslēgts, B2B izslēgts", () => {
    expect(auditSendReviewDefault(false)).toBe(true);
    expect(auditSendReviewDefault(true)).toBe(false);
  });
  it("lēmums: B2B - nekad; noņemts -> «Nelūgt»; bez lauka -> kā vecajā formā (rindā)", () => {
    expect(auditSendReviewDecision({ review: true, b2b: true })).toBe("skip");
    expect(auditSendReviewDecision({ review: false, b2b: true })).toBe("skip");
    expect(auditSendReviewDecision({ review: true, b2b: false })).toBe("enqueue");
    expect(auditSendReviewDecision({ review: false, b2b: false })).toBe("opt_out");
    expect(auditSendReviewDecision({ b2b: false })).toBe("enqueue");
  });
});
