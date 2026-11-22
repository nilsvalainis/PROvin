import { describe, expect, it } from "vitest";
import {
  buildDealerSendMessage,
  dealerSendWhatsappUrl,
  toggleDealerSendOption,
  type DealerSendChannel,
  type DealerSendSituation,
} from "@/lib/dealer-send-message";
import { GOOGLE_REVIEW_URL } from "@/lib/messages/shared-blocks";

const VIN = "WBAUY11040F054037";
const offer = { url: "https://www.provin.lv/lv/papildinajums/abc", priorCents: 2499, chargeCents: 7500, targetCents: 9999 };
const CHANNELS: DealerSendChannel[] = ["email", "whatsapp"];
const SITUATIONS: DealerSendSituation[] = ["ready", "no_data", "cancelled"];

describe("dealer send dialog options", () => {
  it("offer and review request are mutually exclusive", () => {
    let o = toggleDealerSendOption({ offer: false, review: false }, "offer", true);
    expect(o).toEqual({ offer: true, review: false });
    o = toggleDealerSendOption(o, "review", true);
    expect(o).toEqual({ offer: false, review: true });
    o = toggleDealerSendOption(o, "review", false);
    expect(o).toEqual({ offer: false, review: false });
  });
});

describe("dealer send texts", () => {
  it("ready e-mail with offer lists the paid amount, top-up and total and the link", () => {
    const m = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, offer });
    expect(m.subject).toBe(`PROVIN · Atskaite gatava · Oficiālā dīlera dati · ${VIN}`);
    expect(m.text).toContain(`dīlera dati auto VIN ${VIN} ir gatavi - PDF pielikumā.`);
    expect(m.text).toContain("Jau samaksāts: 24,99 €");
    expect(m.text).toContain("Piemaksa: 75,00 €");
    expect(m.text).toContain("Kopā: 99,99 €");
    expect(m.text).toContain(`Apmaksāt: ${offer.url} (saite derīga 30 dienas)`);
    expect(m.text).not.toContain(GOOGLE_REVIEW_URL);
    expect(m.text.endsWith("Ar cieņu,\nNils\nPROVIN.LV")).toBe(true);
  });

  it("ready WhatsApp with review asks for a Google review and has no offer", () => {
    const m = buildDealerSendMessage({ channel: "whatsapp", situation: "ready", b2b: false, vin: VIN, review: true });
    expect(m.subject).toBeUndefined();
    expect(m.text).toContain("PDF pievienoju zemāk.");
    expect(m.text).toContain(`atsauksmi Google: ${GOOGLE_REVIEW_URL}`);
    expect(m.text).not.toContain("Piemaksa");
    expect(m.text.endsWith("Nils, PROVIN.LV")).toBe(true);
  });

  it("never puts the offer and the review request in one message", () => {
    const m = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN, offer, review: true });
    const both = m.text.includes("Piemaksa") && m.text.includes(GOOGLE_REVIEW_URL);
    expect(both).toBe(false);
  });

  it("plain ready message has no offer, no review and no empty gaps", () => {
    const m = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: VIN });
    expect(m.text).toBe(
      [
        "Labdien!",
        "",
        `Jūsu pasūtītie oficiālā dīlera dati auto VIN ${VIN} ir gatavi - PDF pielikumā.`,
        "",
        "Ja ir jautājumi, atbildiet uz šo ziņu vai rakstiet uz info@provin.lv.",
        "",
        "Ar cieņu,",
        "Nils",
        "PROVIN.LV",
      ].join("\n"),
    );
  });

  it("B2B: PROVIN brand without .LV and refund to the account balance", () => {
    const nd = buildDealerSendMessage({ channel: "email", situation: "no_data", b2b: true, vin: VIN, refundCents: 1499 });
    expect(nd.text).toContain("Summu 14,99 € atgriezām Jūsu PROVIN konta atlikumā.");
    expect(nd.text).not.toContain("uz karti");
    expect(nd.text).not.toContain("PROVIN.LV");
    expect(nd.text.endsWith("Nils\nPROVIN")).toBe(true);
    const c = buildDealerSendMessage({ channel: "whatsapp", situation: "cancelled", b2b: true, vin: VIN, refundCents: 1499 });
    expect(c.text).toContain("atgriezām Jūsu PROVIN konta atlikumā.");
    expect(c.text.endsWith("Nils, PROVIN")).toBe(true);
  });

  it("B2C no data: card refund with bank timing", () => {
    const m = buildDealerSendMessage({ channel: "email", situation: "no_data", b2b: false, vin: VIN, refundCents: 2499 });
    expect(m.subject).toBe(`PROVIN · Dīlera dati nav pieejami, nauda atgriezta · ${VIN}`);
    expect(m.text).toContain("Atmaksājām 24,99 € pilnā apmērā uz karti");
    expect(m.text).toContain("5-10 darba dienu laikā");
    expect(m.text).toContain("Pasūtīt: https://www.provin.lv/lv?plan=audits");
  });

  it("ignores offer and review outside «Dati gatavi»", () => {
    const m = buildDealerSendMessage({ channel: "email", situation: "cancelled", b2b: false, vin: VIN, refundCents: 2499, offer, review: true });
    expect(m.text).not.toContain(offer.url);
    expect(m.text).not.toContain(GOOGLE_REVIEW_URL);
  });

  it("all texts follow the writing rules (short dash, no «eksperts», no buy/not-buy promise)", () => {
    for (const channel of CHANNELS) {
      for (const situation of SITUATIONS) {
        for (const b2b of [false, true]) {
          for (const opt of [{}, { offer }, { review: true }]) {
            const m = buildDealerSendMessage({ channel, situation, b2b, vin: VIN, refundCents: 2499, ...opt });
            const all = `${m.subject ?? ""}\n${m.text}`;
            expect(all).not.toMatch(/[—–]/);
            expect(all.toLowerCase()).not.toContain("eksperts");
            expect(all.toLowerCase()).not.toMatch(/pirkt\s*\/\s*nepirkt|ieteikumu pirkt/);
            expect(all).not.toMatch(/\n{3,}/);
            expect(all).not.toMatch(/\{\{|\}\}/);
            if (b2b) expect(all).not.toContain("PROVIN.LV");
          }
        }
      }
    }
  });
});

describe("dealer send WhatsApp link", () => {
  it("opens the client chat with the text", () => {
    expect(dealerSendWhatsappUrl("+371 29 000 000", "Labdien!")).toBe("https://wa.me/37129000000?text=Labdien!");
    expect(dealerSendWhatsappUrl(null, "a b")).toBe("https://wa.me/?text=a%20b");
  });
});
