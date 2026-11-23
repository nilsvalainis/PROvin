import { describe, expect, it } from "vitest";
import {
  auctionArchiveChoiceHref,
  auctionArchiveOfferEmailHtml,
  auctionArchiveOfferSubject,
  auctionArchiveOfferText,
  auctionArchiveOfferWhatsappText,
  auctionArchiveReadyEmailHtml,
  auctionArchiveReadyText,
  auctionArchiveReminderSubject,
  auctionArchiveReminderText,
  auctionArchiveReminderWhatsappText,
} from "@/lib/email/auction-archive-email";
import type { AuctionArchiveSummary } from "@/lib/auction-archive-offer";

const S: AuctionArchiveSummary = {
  vin: "WAUZZZF43PA018831",
  title: "Audi A4 Avant 40 TDI",
  auctions: [
    { key: "openlane:1", date: "2026-10-21", platform: "Openlane", country: "Itālija", km: 193320, priceEur: 13070, photos: 84 },
    { key: "bca:2", date: "2026-10-21", platform: "BCA", country: "Itālija", km: 193320, priceEur: 12410, photos: 0 },
  ],
  photoCount: 84,
  manualSources: [],
};
const URL_ = "https://www.provin.lv/lv/izvele/" + "k".repeat(43);

describe("izsoļu arhīva ziņas", () => {
  it("teksts kā maketā: divas opcijas, nekas nav sūtīts bez izvēles, īsā defise", () => {
    const t = auctionArchiveOfferText(S, 2499);
    expect(t).toContain("Pārbaudījām auto VIN WAUZZZF43PA018831");
    expect(t).toContain("2 izsoles (21.10.2026, Itālija) ar 84 oriģinālajām izsoles bildēm");
    expect(t).toContain("1 - nomainīt dīlera datus uz izsoļu arhīvu (bez piemaksas)");
    expect(t).toContain("2 - atgriezt 24,99 € uz karti");
    expect(t).toContain("Kamēr neizvēlaties, neko nesūtām.");
    for (const x of [t, auctionArchiveOfferWhatsappText(S, 2499), auctionArchiveReadyText(S), auctionArchiveOfferSubject(S)]) {
      expect(x).not.toMatch(/[–—]|ekspert/i);
    }
    expect(auctionArchiveOfferWhatsappText(S, 2499)).toContain("Atbildiet ar 1 vai 2");
  });

  it("vērtības teikums + cenas tikai ar «Rādīt izsoļu cenas» (Nils 23.11)", () => {
    const off = auctionArchiveOfferText(S, 2499);
    expect(off).toContain(
      "Taču atradām to Eiropas izsoļu arhīvā: 2 izsoles (21.10.2026, Itālija) ar 84 oriģinālajām izsoles bildēm un nobraukumu. Bildēs redzams auto stāvoklis pirms tā ievešanas Latvijā - skrāpējumi, iespējamie bojājumi un citas detaļas, ko pēc remonta vai sakopšanas vairs neredz.",
    );
    expect(off).not.toMatch(/cen[āa]/i);
    expect(auctionArchiveOfferText(S, 2499, true)).toContain("ar 84 oriģinālajām izsoles bildēm, cenām un nobraukumu.");
    const wa = auctionArchiveOfferWhatsappText(S, 2499);
    expect(wa).toContain("Bildēs redzams auto stāvoklis pirms tā ievešanas Latvijā");
    expect(wa).not.toMatch(/cenas/);
    expect(auctionArchiveOfferWhatsappText(S, 2499, true)).toContain("cenas, nobraukums");
    expect(auctionArchiveReadyText(S)).not.toMatch(/cenas/);
    expect(auctionArchiveReadyText(S, true)).toContain("cenas");
    const html = auctionArchiveOfferEmailHtml({ summary: S, paidCents: 2499, text: off, choiceUrl: URL_, previews: [] });
    expect(html).not.toContain("Izsoles cenas");
    expect(html).toContain("stāvoklis pirms ievešanas Latvijā");
    expect(auctionArchiveOfferEmailHtml({ summary: S, paidCents: 2499, text: off, choiceUrl: URL_, previews: [], showPrices: true })).toContain("Izsoles cenas");
  });

  it("atgādinājums klientam: tās pašas 2 pogas, vērtības teikums, bez cenām; WhatsApp teksts Nilam ar saiti", () => {
    const t = auctionArchiveReminderText(S, 2499);
    expect(t).toContain("Atgādinām par auto VIN WAUZZZF43PA018831");
    expect(t).toContain("Bildēs redzams auto stāvoklis pirms tā ievešanas Latvijā");
    expect(t).toContain("2 - atgriezt 24,99 € uz karti");
    expect(t).not.toMatch(/cen[āa]/i);
    expect(auctionArchiveReminderSubject(S)).toBe("Atgādinājums: izsoļu arhīvs vai atmaksa (Audi A4 Avant 40 TDI · WAUZZZF43PA018831)");
    const html = auctionArchiveOfferEmailHtml({ summary: S, paidCents: 2499, text: t, choiceUrl: URL_, previews: [], reminder: true });
    expect(html).toContain("Gaidām Jūsu izvēli - izsoļu arhīvs vai atmaksa");
    expect(html).toContain(`href="${auctionArchiveChoiceHref(URL_, "archive")}"`);
    expect(html).toContain(`href="${auctionArchiveChoiceHref(URL_, "refund")}"`);
    const wa = auctionArchiveReminderWhatsappText(S, 2499, URL_);
    expect(wa).toContain(URL_);
    for (const x of [t, wa, auctionArchiveReminderSubject(S)]) expect(x).not.toMatch(/[–—]|ekspert/i);
  });

  it("e-pasts: pogas uz izvēles lapu (iepriekš atzīmēts), izplūdinātās bildes tikai https, bez data:", () => {
    const html = auctionArchiveOfferEmailHtml({
      summary: S,
      paidCents: 2499,
      text: auctionArchiveOfferText(S, 2499),
      choiceUrl: URL_,
      previews: [
        { url: `${URL_.replace("/lv/izvele/", "/api/izvele/")}/foto/0`, caption: "21.10.2026" },
        { url: "data:image/jpeg;base64,AAAA", caption: "x" },
      ],
      date: new Date("2026-11-23T09:00:00Z"),
    });
    expect(html).toContain(`href="${auctionArchiveChoiceHref(URL_, "archive")}"`);
    expect(html).toContain(`href="${auctionArchiveChoiceHref(URL_, "refund")}"`);
    expect(html).toContain("Jā, nomainīt uz izsoļu arhīvu");
    expect(html).toContain("Atgriezt 24,99&nbsp;€");
    expect(html).toContain("/foto/0");
    expect(html).not.toContain("data:");
    expect(html).toContain("Dīlera datu nav - bet atradām izsoļu vēsturi ar bildēm");
    expect(html).toContain("atbildiet uz šo e-pastu ar «1»");
  });

  it("gatavs: pielikuma kartīte", () => {
    const html = auctionArchiveReadyEmailHtml({ summary: S, text: auctionArchiveReadyText(S), attachment: { filename: "a.pdf", bytes: 2_000_000 } });
    expect(html).toContain("Izsoļu arhīvs gatavs");
    expect(html).toContain("a.pdf");
  });
});
