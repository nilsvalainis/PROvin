import { describe, expect, it } from "vitest";
import {
  auctionArchiveChoiceHref,
  auctionArchiveOfferEmailHtml,
  auctionArchiveOfferSubject,
  auctionArchiveOfferText,
  auctionArchiveOfferWhatsappText,
  auctionArchiveReadyEmailHtml,
  auctionArchiveReadyText,
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
