import { describe, expect, it } from "vitest";
import {
  auctionArchiveBasicRows,
  auctionArchiveDamageSchemeHtml,
  auctionArchiveDescriptions,
  buildAuctionArchivePdfHtml,
  damageSlotLv,
} from "@/lib/auction-archive-pdf-html";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const ph = (n: number) => `ih_ph_${String(n).padStart(24, "0")}`;
const rec: ThecarapiAdminRecord = {
  site: "openlane",
  id: "1",
  date: "2026-10-21",
  venue: "Openlane",
  photoDate: "2026-10-21",
  photoUrls: [],
  fields: [
    { key: "mileage", label: "Nobraukums", value: "193320" },
    { key: "colour", label: "Krāsa", value: "Pelēka" },
    { key: "description", label: "Apraksts", value: "Condition: driving, no technical damage, 1 key" },
  ],
  raw: null,
  rawHistory: null,
  rawDetail: null,
  rawImages: null,
  photos: [],
};
const summary = {
  vin: "WAUZZZF43PA018831",
  title: "Audi A4 Avant 40 TDI",
  auctions: [{ key: "openlane:1", date: "2026-10-21", platform: "Openlane", country: "Itālija", km: 193320, priceEur: 13070, photos: 8 }],
  photoCount: 8,
  manualSources: [{ kind: "link" as const, label: "checkcar.vin", url: "https://checkcar.vin/x" }],
};

describe("izsoļu arhīva PDF HTML", () => {
  it("vāks, hronoloģija ar cenu, VISAS bildes pa 6 lapā ar datumiem, apraksts + tulkojums", () => {
    const photos = Array.from({ length: 8 }, (_, i) => ({ id: ph(i + 1), auctionKey: "openlane:1", date: "2026-10-21", caption: i === 6 ? "Odometrs" : "" }));
    const dataUrls = new Map(photos.map((p) => [p.id, "data:image/jpeg;base64,AA"]));
    const html = buildAuctionArchivePdfHtml({
      summary,
      records: [rec],
      photos,
      dataUrls,
      translations: new Map([["Condition: driving, no technical damage, 1 key", "Stāvoklis: braucošs, tehnisku bojājumu nav, 1 atslēga"]]),
      generatedAt: new Date("2026-11-23T08:20:00Z"),
    });
    expect(html).toContain("Eiropas izsoļu arhīvs");
    expect(html).toContain("Izsoles hronoloģiski");
    expect(html).toContain("13 070 €");
    expect(html.match(/<figure class="aa-fig">/g)).toHaveLength(8);
    expect(html.match(/<section class="aa-gallery/g)).toHaveLength(2);
    expect(html).toContain("8 bildes · 2. lapa");
    expect(html).toContain("21.10.2026 · Odometrs");
    expect(html).toContain("(oriģināls)");
    expect(html).toContain("Stāvoklis: braucošs");
    expect(html).toContain("Transportlīdzekļa informācija");
    expect(html).toContain("checkcar.vin");
    expect(html).not.toContain("https://checkcar.vin/x");
    expect(html).not.toMatch(/TheCarApi/);
    expect(html).toContain('data-provin-fonts","ready"');
  });

  it("9 pamatdati; trūkstošie sarkanā «Nav datu»", () => {
    const rows = auctionArchiveBasicRows([rec]);
    expect(rows.map((r) => r.k)).toEqual([
      "Pirmā reģistrācija",
      "Virsbūve",
      "Dzinējs",
      "Krāsa",
      "Jauda",
      "Atslēgas",
      "Ātrumkārba",
      "CO₂",
      "Servisa grāmata",
    ]);
    expect(rows.find((r) => r.k === "Krāsa")?.v).toBe("Pelēka");
    expect(rows.find((r) => r.k === "Jauda")?.vHtml).toContain("aa-missing");
  });

  it("bojājumu shēma: izsoles bojājumi + operatora «Redzams bildē»", () => {
    expect(damageSlotLv("Labā puse", "Aizmugurējās durvis")).toEqual({ zone: "right", slot: 2 });
    expect(damageSlotLv("Priekša", "Buferis")).toEqual({ zone: "front", slot: 1 });
    const html = auctionArchiveDamageSchemeHtml([], [{ auctionKey: "openlane:1", zone: "right", note: "pēdas durvīs" }]);
    expect(html).toContain("Redzams bildē");
    expect(html).toContain("Izsole bojājumus nenorādīja.");
    expect(html).toContain("<svg");
  });

  it("apraksti: bez URL un īsiem laukiem", () => {
    expect(auctionArchiveDescriptions(rec)).toEqual(["Condition: driving, no technical damage, 1 key"]);
  });
});
