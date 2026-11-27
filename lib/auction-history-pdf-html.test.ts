/**
 * Nils 27.11.2026 (makets, variants A): izsoļu sadaļa klienta PDF - faktu kartītes, grupas kartīte atkārtotām
 * izsolēm ar vienādiem datiem, bojājumi vienreiz ar vietām siluetā, foto vienreiz ar «arī izsolē».
 */
import { describe, expect, it } from "vitest";
import {
  auctionDamagePlace,
  auctionDamagePlaceRows,
  auctionHistoryPhotos,
  buildAuctionHistoryHtml,
  cleanAuctionDamages,
  groupAuctionLots,
} from "@/lib/auction-history-pdf-html";
import type { ThecarapiPdfDamage } from "@/lib/thecarapi-pdf-model";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const dmg = (zone: string, part: string, type: string, notes = ""): ThecarapiPdfDamage => ({ zone, part, type, size: "", quantity: "", repair: "", notes });

function rec(site: string, id: string, date: string, opts: { km?: number; bid?: number; damages?: unknown[]; photos?: string[] } = {}): ThecarapiAdminRecord {
  const fields = [
    { key: "mileage", value: String(opts.km ?? 151255) },
    { key: "current_price", value: String(opts.bid ?? 9000) },
    { key: "auction_id", value: id },
    { key: "is_active", value: "false" },
  ];
  return {
    site,
    id,
    date,
    venue: site === "openlane" ? "Openlane" : "Autorola",
    photoDate: date,
    fields,
    photoUrls: [],
    raw: null,
    rawHistory: null,
    rawDetail: opts.damages ? { Damages: opts.damages } : null,
    rawImages: null,
    photos: (opts.photos ?? []).map((u, i) => ({ id: `${id}-${i}`, sourceUrl: u, contentHash: "", date, venue: site, caption: "" })),
  } as unknown as ThecarapiAdminRecord;
}

describe("izsoļu grupēšana", () => {
  it("tā pati platforma, nobraukums un bojājumi - viena grupa; cits nobraukums vai platforma - atsevišķi", () => {
    const d = [dmg("Priekša", "Priekšējais buferis", "Šķemba")];
    const lots = [
      { platform: "Openlane", km: 100, damages: d, date: "2026-10-02" },
      { platform: "Openlane", km: 100, damages: [...d], date: "2026-09-28" },
      { platform: "Autorola", km: 100, damages: d, date: "2026-10-13" },
      { platform: "Openlane", km: 120, damages: d, date: "2026-11-01" },
      { platform: "Openlane", km: 100, damages: [], date: "2026-11-02" },
    ];
    const g = groupAuctionLots(lots);
    expect(g.map((x) => `${x.platform}:${x.lots.length}`)).toEqual(["Openlane:2", "Autorola:1", "Openlane:1", "Openlane:1"]);
    expect(g[0]!.lots[0]!.date).toBe("2026-09-28");
  });

  it("«Text: X» piezīme, kas atkārto veidu, nav otrs bojājums", () => {
    const list = cleanAuctionDamages([dmg("", "", "", "Text: Damage, all around, user damages"), dmg("", "", "Damage, all around, user damages")]);
    expect(list).toHaveLength(1);
  });
});

describe("bojājumu vietas", () => {
  it("LV vieta → detaļa siluetā; nezināms Openlane numurs paliek «Zona N»", () => {
    expect(auctionDamagePlace(dmg("Priekša", "Motora pārsegs", ""))).toEqual({ label: "Motora pārsegs", panel: "hood" });
    expect(auctionDamagePlace(dmg("Jumts", "", "")).panel).toBe("roof");
    expect(auctionDamagePlace(dmg("Zona 77", "", ""))).toEqual({ label: "Zona 77", panel: null });
    expect(auctionDamagePlace(dmg("Zona 77", "", ""), "en").label).toBe("Zone 77");
  });

  it("saraksts grupēts pa vietām: «Motora pārsegs - akmens šķemba, iespiedums»", () => {
    const rows = auctionDamagePlaceRows([dmg("Priekša", "Motora pārsegs", "Akmens šķemba"), dmg("Priekša", "Motora pārsegs", "Iespiedums"), dmg("Jumts", "", "Iespiedums")]);
    expect(rows.map((r) => `${r.n} ${r.label}: ${r.kinds.join(", ")}`)).toEqual(["1 Motora pārsegs: akmens šķemba, iespiedums", "2 Jumts: iespiedums"]);
  });
});

describe("foto vienreiz", () => {
  it("tā pati foto vairākās izsolēs pieder pirmajai, pārējās - «arī izsolē»", () => {
    const a = rec("openlane", "1", "2026-10-02", { photos: ["u1", "u2"] });
    const b = rec("openlane", "2", "2026-09-28", { photos: ["u1"] });
    const lots = [
      { key: "openlane:1", record: a, platform: "Openlane", date: a.date },
      { key: "openlane:2", record: b, platform: "Openlane", date: b.date },
    ];
    const photos = [...a.photos, ...b.photos];
    const out = auctionHistoryPhotos(lots, photos);
    expect(out.map((p) => `${p.date}:${p.index}/${p.total}:${p.alsoDates.join(",")}`)).toEqual(["2026-09-28:1/1:2026-10-02", "2026-10-02:2/2:"]);
  });
});

describe("sadaļas HTML", () => {
  it("faktu kartītes, viena grupas kartīte ar tabulu, nav atslēgu un arhīva tehnisko lauku", () => {
    const records = [
      rec("openlane", "11", "2026-09-28", { bid: 9700 }),
      rec("openlane", "12", "2026-10-02", { bid: 9500 }),
      rec("openlane", "13", "2026-10-09", { bid: 10800 }),
      rec("autorola", "21", "2026-10-13", { bid: 9600 }),
    ];
    const html = buildAuctionHistoryHtml({ records });
    expect(html).toContain("ah-tiles");
    expect((html.match(/class="ah-card"/g) ?? []).length).toBe(2);
    expect(html).toContain("3 izsoles · dati vienādi");
    expect(html).toContain("4 reizes");
    expect(html).toMatch(/augst\./);
    expect(html).not.toMatch(/Atslēgas|Pirmoreiz fiksēts|Skatījumi|Piegādes laiks/);
    const en = buildAuctionHistoryHtml({ records, lang: "en" });
    expect(en).toContain("3 auctions · same data");
    expect(en).not.toMatch(/izsole|Datums/);
  });
});
