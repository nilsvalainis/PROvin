import { describe, expect, it } from "vitest";
import type { AuctionArchiveSummary } from "@/lib/auction-archive-offer";
import {
  appendAuctionArchiveReportSend,
  auctionArchiveReportContentsLine,
  auctionArchiveReportPdfFilename,
  auctionArchiveReportStatusLine,
  buildAuctionArchiveSendMessage,
  parseAuctionArchiveReportDoc,
} from "@/lib/auction-archive-report";
import { dealerDataOperatorMessageEmailHtml } from "@/lib/email/html-templates";
import { getMessageTemplateDef } from "@/lib/messages/registry";

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

describe("izsoļu arhīvs - atsevišķais pakalpojums", () => {
  it("faila nosaukums IZSOLU_ARHIVS_<VIN>.pdf", () => {
    expect(auctionArchiveReportPdfFilename("wauzzzf43pa018831")).toBe("IZSOLU_ARHIVS_WAUZZZF43PA018831.pdf");
    expect(auctionArchiveReportPdfFilename("")).toBe("IZSOLU_ARHIVS_VIN.pdf");
  });

  it("saturs: vērtības teikums, cenas tikai ar ķeksi", () => {
    const plain = auctionArchiveReportContentsLine(S, false);
    expect(plain).toBe(
      "Arhīvā: 2 izsoles (21.10.2026, Itālija), 84 oriģinālās izsoles bildes ar datumiem, nobraukums un bojājumi pa zonām. Bildēs redzams auto stāvoklis pirms tā ievešanas Latvijā - skrāpējumi, iespējamie bojājumi un citas detaļas, ko pēc remonta vai sakopšanas vairs neredz.",
    );
    expect(auctionArchiveReportContentsLine(S, true)).toContain("ar datumiem, cenas, nobraukums");
  });

  it("veidnes reģistrā (labojamas «Šabloni»), 3 gadījumi × 2 kanāli", () => {
    for (const ch of ["email", "wa"]) {
      for (const sit of ["ready", "no_data", "cancelled"]) expect(getMessageTemplateDef(`${ch}.auction_archive_send.${sit}`)).toBeTruthy();
    }
  });

  it("«Arhīvs gatavs» e-pasts kā dīlera datiem, pielāgots; ar piedāvājumu un atsauksmi", () => {
    const m = buildAuctionArchiveSendMessage({
      channel: "email",
      situation: "ready",
      b2b: false,
      vin: S.vin,
      summary: S,
      refundCents: 2499,
      offer: { url: "https://www.provin.lv/lv/papildinajums/abc", priorCents: 2499, chargeCents: 7500, targetCents: 9999 },
      review: true,
    });
    expect(m.subject).toBe("PROVIN · Atskaite gatava · Izsoļu arhīvs · WAUZZZF43PA018831");
    expect(m.text).toContain("Jūsu pasūtītais izsoļu arhīvs auto VIN WAUZZZF43PA018831 ir gatavs - PDF pielikumā.");
    expect(m.text).toContain("Bildēs redzams auto stāvoklis pirms tā ievešanas Latvijā");
    expect(m.text).toContain("Piemaksa: 75,00 €");
    expect(m.text).toContain("Apmaksāt: https://www.provin.lv/lv/papildinajums/abc");
    expect(m.text).toMatch(/atsauksmi Google: https:\/\//);
    expect(m.text).not.toMatch(/cenas/);
    expect(m.text).not.toMatch(/[–—]|ekspert/i);
    const html = dealerDataOperatorMessageEmailHtml({
      text: m.text,
      context: { situation: "ready", productKind: "auction_archive", vin: S.vin, attachments: [{ filename: "IZSOLU_ARHIVS_WAUZZZF43PA018831.pdf", bytes: 4_000_000 }] },
    });
    expect(html).toContain("Izsoļu arhīvs gatavs");
    expect(html).toContain("IZSOLU_ARHIVS_WAUZZZF43PA018831.pdf");
    expect(html).toContain("Jau samaksāts (izsoļu arhīvs)");
    expect(html).toContain("Dīlera servisa vēsture");
  });

  it("«Datu nav» un «Atcelts»: atmaksas teksts, bez apraksta; WhatsApp bez temata", () => {
    const no = buildAuctionArchiveSendMessage({ channel: "email", situation: "no_data", b2b: false, vin: S.vin, summary: S, refundCents: 2499 });
    expect(no.subject).toContain("Izsoļu arhīvā datu nav");
    expect(no.text).toContain("Eiropas izsoļu arhīvā par šo auto ierakstu nav");
    expect(no.text).toContain("Atmaksājām 24,99 €");
    expect(no.text).not.toContain("Arhīvā:");
    const wa = buildAuctionArchiveSendMessage({ channel: "whatsapp", situation: "cancelled", b2b: true, vin: S.vin, refundCents: 2499 });
    expect(wa.subject).toBeUndefined();
    expect(wa.text).toContain("Atcēlām Jūsu izsoļu arhīva pasūtījumu");
    expect(wa.text).toContain("PROVIN konta atlikumā");
    expect(wa.text).toContain("Nils, PROVIN");
  });

  it("žurnāls: «Nosūtīts klientam: …» kā dīlera datiem; parse atmet nederīgo", () => {
    expect(auctionArchiveReportStatusLine(null)).toBe("Nav nosūtīts");
    const doc = appendAuctionArchiveReportSend(
      { sessionId: "cs_1", sends: [] },
      { at: "2026-11-23T12:32:00.000Z", channel: "email", situation: "ready", offer: false, review: true },
    );
    expect(auctionArchiveReportStatusLine(doc)).toBe("Nosūtīts klientam: 23.11.2026 14:32 (izsoļu arhīvs, e-pasts, ar atsauksmi)");
    const parsed = parseAuctionArchiveReportDoc(
      { ...doc, showPrices: true, photos: 84, sends: [...doc.sends, { at: "x", channel: "fax", situation: "ready" }] },
      "cs_1",
    );
    expect(parsed.sends).toHaveLength(1);
    expect(parsed.showPrices).toBe(true);
    expect(parsed.photos).toBe(84);
  });
});
