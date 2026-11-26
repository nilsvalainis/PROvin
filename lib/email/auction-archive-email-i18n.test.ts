import { describe, expect, it } from "vitest";
import type { AuctionArchiveSummary } from "@/lib/auction-archive-offer";
import {
  auctionArchiveOfferEmailHtml,
  auctionArchiveOfferPlainText,
  auctionArchiveOfferSubject,
  auctionArchiveOfferText,
  auctionArchiveOfferWhatsappText,
  auctionArchiveReadyEmailHtml,
  auctionArchiveReadySubject,
  auctionArchiveReadyText,
  auctionArchiveReadyWhatsappText,
  auctionArchiveReminderSubject,
  auctionArchiveReminderText,
  auctionArchiveReminderWhatsappText,
} from "@/lib/email/auction-archive-email";
import { applyB2bSignature } from "@/lib/messages/localized-templates";

/** «Izsoļu arhīvs dīlera datu vietā» klienta valodā (Nils 26.11). */
const VIN = "WAUZZZF43PA018831";
const S: AuctionArchiveSummary = {
  vin: VIN,
  title: "Audi A4 Avant 40 TDI",
  auctions: [
    { key: "openlane:1", date: "2026-10-21", platform: "Openlane", country: "Itālija", km: 193320, priceEur: 13070, photos: 84 },
    { key: "bca:2", date: "2026-10-21", platform: "BCA", country: "Itālija", km: 193320, priceEur: null, photos: 0 },
  ],
  photoCount: 84,
  manualSources: [],
};
const URL = "https://www.provin.lv/de/izvele/TOKEN";
const LV = /[āēīūčšžģķļņ]|\b(Labdien|Jūsu|Ar cieņu|izsole|Atgriezt|Izvēlieties)\b/iu;
const country = { en: "Italy", ru: "Италия", de: "Italien" } as const;

function rules(t: string): void {
  expect(t).not.toMatch(/[—–]/);
  expect(t).not.toMatch(/expert|эксперт|Experte|eksperts/i);
  expect(t).not.toMatch(/don't buy|nicht kaufen|не покупать/i);
}

describe("izsoļu arhīva piedāvājums / atgādinājums / gatavs klienta valodā", () => {
  for (const lang of ["en", "ru", "de"] as const) {
    it(`${lang}: teksti, WhatsApp un HTML bez LV`, () => {
      const texts = [
        auctionArchiveOfferSubject(S, lang),
        auctionArchiveOfferText(S, 2499, true, lang),
        auctionArchiveOfferWhatsappText(S, 2499, false, lang),
        auctionArchiveReminderSubject(S, lang),
        auctionArchiveReminderText(S, 2499, false, lang),
        auctionArchiveReminderWhatsappText(S, 2499, URL, lang),
        auctionArchiveReadySubject(S, lang),
        auctionArchiveReadyText(S, true, lang),
        auctionArchiveReadyWhatsappText(S, lang),
        auctionArchiveOfferPlainText("x", URL, lang),
      ];
      for (const t of texts) {
        expect(LV.exec(t)?.[0] ?? null, t).toBeNull();
        rules(t);
      }
      expect(auctionArchiveOfferText(S, 2499, false, lang)).toContain(VIN);
      expect(auctionArchiveOfferText(S, 2499, false, lang)).toContain("24,99 €");
      expect(auctionArchiveOfferText(S, 2499, false, lang)).toContain(country[lang]);
      expect(auctionArchiveReminderWhatsappText(S, 2499, URL, lang)).toContain(URL);
      const html = auctionArchiveOfferEmailHtml({ summary: S, paidCents: 2499, text: auctionArchiveOfferText(S, 2499, false, lang), choiceUrl: URL, previews: [], lang });
      expect(html).toContain(`<html lang="${lang}"`);
      expect(html).toContain(`${URL}?v=archive`);
      expect(html).toContain("24,99&nbsp;€");
      const visible = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
      expect(LV.exec(visible)?.[0] ?? null).toBeNull();
      const reminder = auctionArchiveOfferEmailHtml({ summary: S, paidCents: 2499, text: "x", choiceUrl: URL, previews: [], reminder: true, lang });
      expect(LV.exec(reminder.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " "))?.[0] ?? null).toBeNull();
      const ready = auctionArchiveReadyEmailHtml({ summary: S, text: "x", attachment: { filename: "a.pdf", bytes: 1000 }, lang });
      expect(ready).toContain(`<html lang="${lang}"`);
      expect(LV.exec(ready.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " "))?.[0] ?? null).toBeNull();
    });

    it(`${lang}: B2B paraksts tikai «PROVIN»`, () => {
      const email = applyB2bSignature(auctionArchiveOfferText(S, 2499, false, lang));
      expect(email).not.toMatch(/\bNils\b|PROVIN\.LV/);
      expect(email.trim().split("\n").pop()).toBe("PROVIN");
      const wa = applyB2bSignature(auctionArchiveReadyWhatsappText(S, lang));
      expect(wa.trim().split("\n").pop()).toBe("PROVIN");
    });
  }

  it("LV un nezināma valoda - kā līdz šim", () => {
    expect(auctionArchiveOfferText(S, 2499, false, "lv")).toBe(auctionArchiveOfferText(S, 2499, false));
    expect(auctionArchiveOfferText(S, 2499, false, null)).toMatch(/^Labdien!/);
    expect(auctionArchiveReadySubject(S)).toMatch(/^Izsoļu arhīvs/);
    expect(auctionArchiveOfferEmailHtml({ summary: S, paidCents: 2499, text: "x", choiceUrl: URL, previews: [] })).toContain('<html lang="lv"');
    expect(auctionArchiveOfferPlainText("x", URL)).toContain("Izvēlēties un apstiprināt:");
  });
});
