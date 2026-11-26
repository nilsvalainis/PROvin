import { describe, expect, it } from "vitest";
import type { AuctionArchiveSummary } from "@/lib/auction-archive-offer";
import { auctionArchiveReportContentsLineI18n, buildAuctionArchiveSendMessage } from "@/lib/auction-archive-report";
import { buildUnpaidReminderMailCopy } from "@/lib/admin-unpaid-reminder-mail";
import { buildB2bWalletOrderNoteParts } from "@/lib/b2b-wallet";
import { b2bWalletRefundEmailProduct, renderB2bWalletRefundEmail } from "@/lib/b2b-wallet-refund-email";
import { renderB2bTopupInvoiceEmail } from "@/lib/b2b-topup-invoice";
import { buildClientLinkEmailCopy } from "@/lib/client-link";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { resolveOrderClientLang } from "@/lib/email/client-lang-email-copy";
import { buildUpsellDraft, type OrderUpsellKind } from "@/lib/order-upsell";
import { messageTemplatesDocFromOverrides } from "@/lib/messages/shared-block-vars";

/**
 * 25.11 (2. kārta): e-pasti, kuriem līdz šim nebija valodas - neapmaksātā atgādinājums, klienta saite,
 * upsell, izsoļu arhīvs, B2B maka atmaksa un papildināšanas rēķins. Valoda no esošajiem datiem
 * (B2B atskaites valoda / Stripe session.locale), citādi LV.
 */
const LV_MARKERS = /[āēīūčšžģķļņĀĒĪŪČŠŽĢĶĻŅ]|\b(Labdien|Jūsu|Ar cieņu|Sveiki|Paldies|Pielikumā|Pasūtīt|Apmaksāt|Summa|Saite)\b/u;
const FOREIGN = ["en", "ru", "de"] as const;
const VIN = "WAUZZZF43PA018831";
const URL = "https://www.provin.lv/apmaksa/abc";

function lvLeak(text: string): string | null {
  return LV_MARKERS.exec(text)?.[0] ?? null;
}

/** Teksti: īsā defise, bez «eksperts», bez «pirkt / nepirkt» verdikta. */
function rulesOk(text: string): void {
  expect(text).not.toMatch(/[—–]/);
  expect(text).not.toMatch(/expert|эксперт|Experte|eksperts/i);
  expect(text).not.toMatch(/\b(don't buy|do not buy|nicht kaufen|не покупать)\b/i);
}

describe("valodas noteikšana pasūtījumam", () => {
  const b2bNotes = (lang: "lv" | "en" | "ru" | "de") =>
    buildB2bWalletOrderNoteParts({ txnId: "wtx_1_1_abc", product: "dealer_pro", priceCents: 1999, reportLang: lang }).join(" · ");

  it("B2B atskaites valoda pirms Stripe valodas; citādi Stripe locale; citādi LV", () => {
    expect(resolveOrderClientLang({ notes: b2bNotes("de"), locale: "en" })).toBe("de");
    expect(resolveOrderClientLang({ notes: "", locale: "ru" })).toBe("ru");
    expect(resolveOrderClientLang({ notes: null, locale: "de-DE" })).toBe("de");
    expect(resolveOrderClientLang({ notes: null, locale: "fr" })).toBe("lv");
    expect(resolveOrderClientLang({})).toBe("lv");
  });
});

describe("neapmaksāta pasūtījuma atgādinājums", () => {
  for (const lang of FOREIGN) {
    it(`${lang}: viss teksts klienta valodā, saite un VIN vietā`, () => {
      const c = buildUnpaidReminderMailCopy({ vin: VIN, paymentUrl: URL, locale: lang });
      expect(lvLeak(`${c.subject}\n${c.text}`)).toBeNull();
      expect(c.subject).toContain(VIN);
      expect(c.text).toContain(URL);
      expect(c.text).toContain(VIN);
      expect(c.text.trim().split("\n").pop()).toBe("PROVIN.LV");
      rulesOk(c.text);
    });
  }

  it("bez valodas - LV kā līdz šim; LV admina pārraksts ne-LV klientam netiek lietots", () => {
    const lv = buildUnpaidReminderMailCopy({ vin: VIN, paymentUrl: URL, locale: null });
    expect(lv.text.startsWith("Labdien!")).toBe(true);
    const doc = messageTemplatesDocFromOverrides({ "email.unpaid_reminder": { subject: "LV {{vin}}", body: "Labdien! {{maksājuma_saite}}" } });
    expect(buildUnpaidReminderMailCopy({ vin: VIN, paymentUrl: URL, locale: "lv", doc }).text).toBe(`Labdien! ${URL}`);
    expect(lvLeak(buildUnpaidReminderMailCopy({ vin: VIN, paymentUrl: URL, locale: "de", doc }).text)).toBeNull();
  });
});

describe("personīgā apmaksas saite", () => {
  const base = { url: URL, productName: "PROVIN AUDIT", expiresAt: "2026-12-01T10:00:00.000Z", amountCents: 9999, vin: VIN };
  for (const lang of FOREIGN) {
    it(`${lang}`, () => {
      const c = buildClientLinkEmailCopy({ ...base, lang });
      expect(lvLeak(`${c.subject}\n${c.text}`)).toBeNull();
      expect(c.text).toContain("99,99 €");
      expect(c.text).toContain(URL);
      rulesOk(c.text);
    });
  }
  it("bez valodas - LV", () => {
    expect(buildClientLinkEmailCopy(base).text.startsWith("Labdien!")).toBe(true);
  });
});

describe("upsell piedāvājumi", () => {
  const KINDS: OrderUpsellKind[] = ["mini_to_dealer", "dealer_to_audit", "mini_to_audit"];
  const base = { vin: VIN, customerName: "Anna Ozola", car: "Audi A4", url: URL, priorCents: 2499, chargeCents: 7500, targetCents: 9999 };
  for (const kind of KINDS) {
    for (const lang of FOREIGN) {
      for (const b2b of [false, true]) {
        it(`${kind} ${lang} ${b2b ? "B2B" : "B2C"}`, () => {
          const d = buildUpsellDraft({ ...base, kind, lang, b2b });
          for (const t of [d.subject, d.emailText, d.whatsappText]) {
            expect(lvLeak(t), t).toBeNull();
            rulesOk(t);
          }
          expect(d.emailText).toContain(URL);
          expect(d.whatsappText).toContain(URL);
          expect(d.subject).toContain(VIN);
          const last = d.emailText.trim().split("\n").pop();
          expect(last).toBe(b2b ? "PROVIN" : "PROVIN.LV");
          expect(`${d.emailText}\n${d.whatsappText}`).not.toMatch(b2b ? /\bNils\b/ : /^$/);
        });
      }
    }
  }

  it("MINI -> AUDITS: vārds bez LV vokatīva, auto un starpība", () => {
    const d = buildUpsellDraft({ ...base, kind: "mini_to_audit", lang: "de" });
    expect(d.emailText.startsWith("Guten Tag Anna,")).toBe(true);
    expect(d.emailText).toContain("(Audi A4), FIN " + VIN);
    expect(d.emailText).toContain("(75,00 €)");
    const noName = buildUpsellDraft({ ...base, customerName: "", car: "", kind: "mini_to_audit", lang: "en" });
    expect(noName.emailText.startsWith("Hello,")).toBe(true);
    expect(noName.emailText).not.toContain("{");
  });

  it("LV paliek kā līdz šim", () => {
    const d = buildUpsellDraft({ ...base, kind: "dealer_to_audit" });
    expect(d.emailText.startsWith("Labdien!")).toBe(true);
  });
});

describe("izsoļu arhīvs «Sūtīt klientam»", () => {
  const S: AuctionArchiveSummary = {
    vin: VIN,
    title: "Audi A4 Avant 40 TDI",
    auctions: [{ key: "openlane:1", date: "2026-10-21", platform: "Openlane", country: "Itālija", km: 193320, priceEur: 13070, photos: 84 }],
    photoCount: 84,
    manualSources: [],
  };
  const OFFER = { url: URL, priorCents: 2499, chargeCents: 7500, targetCents: 9999 };

  it("arhīva saturs klienta valodā, valsts tulkota", () => {
    expect(auctionArchiveReportContentsLineI18n(S, false, "de")).toMatch(/^Im Archiv: 1 Auktion \(21\.10\.2026, Italien\), 84 originale Auktionsfotos/);
    expect(auctionArchiveReportContentsLineI18n(S, true, "en")).toContain("with dates, prices, mileage");
    expect(auctionArchiveReportContentsLineI18n({ ...S, auctions: [S.auctions[0]!, { ...S.auctions[0]!, key: "b" }] }, false, "ru")).toMatch(
      /^В архиве: 2 аукциона \(21\.10\.2026, Италия\)/,
    );
    expect(auctionArchiveReportContentsLineI18n(S, false, "lv")).toMatch(/^Arhīvā: 1 izsole/);
  });

  for (const lang of FOREIGN) {
    for (const situation of ["ready", "no_data", "cancelled"] as const) {
      for (const channel of ["email", "whatsapp"] as const) {
        for (const b2b of [false, true]) {
          it(`${lang} ${channel} ${situation} ${b2b ? "B2B" : "B2C"}`, () => {
            const m = buildAuctionArchiveSendMessage({
              channel,
              situation,
              b2b,
              vin: VIN,
              summary: S,
              refundCents: 2499,
              offer: situation === "ready" ? OFFER : null,
              review: situation === "ready",
              lang: lang as ClientReportLang,
            });
            expect(lvLeak(`${m.subject ?? ""}\n${m.text}`), m.text).toBeNull();
            rulesOk(m.text);
            expect(m.text).toContain(VIN);
            if (channel === "email") expect(m.subject).toContain(VIN);
            if (b2b) {
              expect(m.text).not.toMatch(/\bNils\b/);
              expect(m.text.trim().split("\n").pop()).toBe("PROVIN");
            }
            if (situation !== "ready") expect(m.text).toContain("24,99 €");
            if (situation === "no_data") expect(m.text).toContain(`provin.lv/${lang}?plan=audits`);
          });
        }
      }
    }
  }
});

describe("B2B maks: atmaksa un papildināšanas rēķins", () => {
  const vars = { vin: VIN, summa: "19,99 €", atlikums: "120,00 €", produkts: b2bWalletRefundEmailProduct("dealer_pro", "de") };
  for (const lang of FOREIGN) {
    it(`atmaksa ${lang}`, () => {
      const r = renderB2bWalletRefundEmail({ ...vars, produkts: b2bWalletRefundEmailProduct("dealer_raw", lang) }, lang);
      expect(lvLeak(`${r.subject}\n${r.text}`)).toBeNull();
      expect(r.text).toContain("19,99 €");
      expect(r.text.trim().split("\n").pop()).toBe("PROVIN");
      expect(r.text).not.toMatch(/\bNils\b|IRISS|PROVIN\.LV/);
    });
    it(`papildināšanas rēķins ${lang}`, () => {
      const r = renderB2bTopupInvoiceEmail({ summa: "100,00 €", atlikums: "120,00 €", rekins: "IRS-2026-0001", uznemums: "" }, lang);
      expect(lvLeak(`${r.subject}\n${r.text}`)).toBeNull();
      expect(r.text).toContain("IRS-2026-0001");
      expect(r.text.trim().split("\n").pop()).toBe("PROVIN");
    });
  }
  it("LV un nezināma valoda - LV teksts", () => {
    expect(renderB2bWalletRefundEmail(vars).text.startsWith("Sveiki!")).toBe(true);
    expect(renderB2bTopupInvoiceEmail({ summa: "1,00 €", atlikums: "1,00 €", rekins: "x", uznemums: "" }, "fr").text.startsWith("Sveiki!")).toBe(true);
    expect(b2bWalletRefundEmailProduct("dealer_pro", "lv")).toBe("Dīlera dati PRO");
    expect(vars.produkts).toBe("Händlerdaten PRO");
  });
});
