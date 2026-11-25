import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { thecarapiDamagePhotoIndexes } from "@/components/admin/AdminThecarapiRecords";
import { buildAuctionArchiveSummary } from "@/lib/auction-archive-offer";
import {
  AUCTION_DAMAGE_THUMBS_MAX,
  AUCTION_LOT_CARDS_CSS,
  auctionArchiveDamageBlockHtml,
  auctionDamageThumbs,
  auctionLotRecordKey,
  buildAuctionLotsHtml,
} from "@/lib/auction-lot-cards-html";
import { buildCcVinAuctionCardsHtml } from "@/lib/cc-vin-pdf-html";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import { buildThecarapiPdfModel, type ThecarapiPdfDamage } from "@/lib/thecarapi-pdf-model";
import { buildThecarapiAdminRecords } from "@/lib/vin-scan/parse-thecarapi";
import type { ThecarapiAdminRecord, ThecarapiStoredPhoto } from "@/lib/vin-scan/thecarapi-fields";

function fixture(name: string): unknown {
  const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi", name);
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

const HISTORY = {
  auctions: [{ site_name: "auto1", auction_id: "1326383403", mileage: 226760, current_final: 11379, first_seen: "2026-10-07" }],
};

const D1 = "https://img-pa.auto1.com/img3b/test/BS00000_d1.jpg";
const D2 = "https://img-pa.auto1.com/img3b/test/BS00000_d2.jpg";
const D3 = "https://img-pa.auto1.com/img3b/test/BS00000_d3.jpg";
const MAIN = "https://img-pa.auto1.com/img3b/test/BS00000_main.jpg";

function photo(id: string, sourceUrl: string, date = "2026-10-09"): ThecarapiStoredPhoto {
  return { id, sourceUrl, contentHash: "", date, venue: "AUTO1", caption: "" };
}

function auto1Record(photos: ThecarapiStoredPhoto[] = []): ThecarapiAdminRecord {
  const [row] = buildThecarapiAdminRecords({ historyJson: HISTORY, detailJson: fixture("detail-auto1-full-anon.json") });
  return { ...row!, photos };
}

const dmg = (over: Partial<ThecarapiPdfDamage>): ThecarapiPdfDamage => ({
  zone: "Aizmugure",
  part: "Aizmugurējais buferis",
  type: "Skrāpējums",
  size: "",
  quantity: "1",
  repair: "",
  notes: "",
  ...over,
});

describe("bojājumu bildes: sasaiste modelī", () => {
  it("AUTO1 DamagesV3.subAreaImages -> katram bojājumam tieši viņa bilde", () => {
    const model = buildThecarapiPdfModel(auto1Record());
    const byKey = Object.fromEntries(model.damages.map((d) => [`${d.part}|${d.type}`, d.photoUrls]));
    expect(byKey["Priekšējais buferis|Skrāpējums līdz gruntij"]).toEqual([D3]);
    expect(byKey["Aizmugurējais buferis|Skrāpējums līdz gruntij"]).toEqual([D1]);
    expect(byKey["Aizmugurējais buferis|Trūkst detaļas"]).toEqual([D2]);
  });

  it("avots bez sasaistes (Openlane, BCA): lauka photoUrls nav", () => {
    for (const name of ["detail-openlane-v1-synth.json", "detail-bca-synth.json"]) {
      const [row] = buildThecarapiAdminRecords({ historyJson: null, detailJson: fixture(name) });
      if (!row) continue;
      const model = buildThecarapiPdfModel(row);
      expect(model.damages.length, name).toBeGreaterThan(0);
      for (const d of model.damages) expect(d, name).not.toHaveProperty("photoUrls");
    }
  });

  it("vispārīgs avots: bojājuma ierakstā ligzdotas bildes (images[].url) piesaistās tam bojājumam; dublikāts apvieno saites", () => {
    const raw = {
      site_name: "openlane",
      auction_id: "77",
      damages: [
        { part: "front-bumper", type: "scratch", area: "front", images: [{ url: "https://cdn.example.com/a.jpg" }] },
        { part: "front-bumper", type: "scratch", area: "front", images: [{ url: "https://cdn.example.com/b.jpg" }, { url: "https://cdn.example.com/a.jpg" }] },
        { part: "rear-left-door", type: "dent", area: "left" },
      ],
    };
    const record: ThecarapiAdminRecord = {
      site: "openlane",
      id: "77",
      date: "2026-10-01",
      venue: "Openlane",
      photoDate: "2026-10-01",
      fields: [],
      photoUrls: [],
      photos: [],
      raw,
      rawHistory: null,
      rawDetail: null,
      rawImages: null,
    } as unknown as ThecarapiAdminRecord;
    const model = buildThecarapiPdfModel(record);
    expect(model.damages).toHaveLength(2);
    expect(model.damages[0]!.photoUrls).toEqual(["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]);
    expect(model.damages[1]).not.toHaveProperty("photoUrls");
  });
});

describe("bojājumu bildes: PDF izsoles kartīte", () => {
  it("bez sīktēliem bloks ir tieši tāds pats kā līdz šim", () => {
    const damages = [dmg({}), dmg({ part: "Priekšējais buferis", zone: "Priekša", photoUrls: [D1] })];
    const before = auctionArchiveDamageBlockHtml(damages, []);
    expect(auctionArchiveDamageBlockHtml(damages, [], [[], []])).toBe(before);
    expect(auctionArchiveDamageBlockHtml(damages, [], auctionDamageThumbs(damages, null, [], new Map()))).toBe(before);
    expect(before).not.toContain("aa-dmg__thumb");
  });

  it("sīktēls ar datumu zem konkrētā bojājuma rindas; pārējās rindas bez bildēm", () => {
    const damages = [dmg({ photoUrls: [D1] }), dmg({ part: "Priekšējais buferis", zone: "Priekša" })];
    const record = { photos: [photo("p1", D1, "2026-10-09")], photoDate: "", date: "" };
    const thumbs = auctionDamageThumbs(damages, record, [], new Map([["p1", "data:image/jpeg;base64,D1"]]));
    expect(thumbs).toEqual([[{ src: "data:image/jpeg;base64,D1", date: "2026-10-09" }], []]);
    const html = auctionArchiveDamageBlockHtml(damages, [], thumbs);
    const rows = html.slice(html.indexOf('<ul class="aa-dmg__list">')).split("<li");
    expect(rows[1]).toContain('class="aa-dmg--ph"');
    expect(rows[1]).toContain('<figure class="aa-dmg__thumb"><img src="data:image/jpeg;base64,D1" alt=""/><figcaption>09.10.2026</figcaption></figure>');
    expect(rows[2]).not.toContain("aa-dmg__thumb");
  });

  it("bilde bez datuma - bez paraksta; vairāk par limitu - «+N»", () => {
    const urls = Array.from({ length: AUCTION_DAMAGE_THUMBS_MAX + 2 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
    const damages = [dmg({ photoUrls: urls })];
    const photos = urls.map((u, i) => ({ id: `x${i}`, auctionKey: "k", date: "", caption: "", sourceUrl: u }));
    const thumbs = auctionDamageThumbs(damages, null, photos, new Map(photos.map((p) => [p.id, `data:${p.id}`])));
    const html = auctionArchiveDamageBlockHtml(damages, [], thumbs);
    expect(html.match(/aa-dmg__thumb"/g)).toHaveLength(AUCTION_DAMAGE_THUMBS_MAX);
    expect(html).toContain('<span class="aa-dmg__more">+2</span>');
    expect(html).not.toContain("<figcaption>");
  });

  it("mierīgs stils: #D2D2D7 apmale, Inter, bez jaunām krāsām", () => {
    const css = AUCTION_LOT_CARDS_CSS.split("\n").filter((l) => l.includes("aa-dmg__thumb") || l.includes("aa-dmg__ph"));
    expect(css.join("\n")).toContain("border:1px solid #D2D2D7");
    expect(css.join("\n")).toContain("Inter");
    for (const line of css) expect(line).not.toMatch(/#(B91C1C|B45309|DC2626|EF4444|F59E0B)/i);
  });

  it("klienta PDF (buildCcVinAuctionCardsHtml): AUTO1 bojājumiem savas bildes, galerija paliek", () => {
    const record = auto1Record([photo("p1", D1), photo("p2", D2), photo("p3", D3), photo("p4", MAIN)]);
    const dataUrls = new Map(["p1", "p2", "p3", "p4"].map((id) => [id, `data:image/jpeg;base64,${id.toUpperCase()}`]));
    const html = buildCcVinAuctionCardsHtml({ thecarapiRecords: [record] } as unknown as CcVinBlockState, {
      photos: record.photos,
      dataUrls,
    });
    const dmgBlock = html.slice(html.indexOf("aa-dmg__list"), html.indexOf("</ul>", html.indexOf("aa-dmg__list")));
    const items = dmgBlock.split("<li").slice(1);
    const rowOf = (part: string, type: string) => items.find((li) => li.includes(part) && li.includes(type)) ?? "";
    expect(rowOf("Priekšējais buferis", "Skrāpējums")).toContain("base64,P3");
    expect(rowOf("Aizmugurējais buferis", "Skrāpējums")).toContain("base64,P1");
    expect(rowOf("Aizmugurējais buferis", "Trūkst")).toContain("base64,P2");
    expect(dmgBlock).not.toContain("base64,P4");
    expect(dmgBlock).toContain("<figcaption>09.10.2026</figcaption>");
    // Kopējā galerija nemainās - visas 4 bildes joprojām tur.
    const gallery = html.slice(html.indexOf('class="aa-gallery"'));
    for (const id of ["P1", "P2", "P3", "P4"]) expect(gallery).toContain(`base64,${id}`);
    expect(dmgBlock).not.toContain("https://");
    expect(dmgBlock).not.toMatch(/€/);
  });

  it("izsoļu arhīva PDF: bilde ar citu id (kopija) atrodama pēc sourceUrl", () => {
    const record = auto1Record([]);
    const summary = buildAuctionArchiveSummary({ vin: "", title: "", block: { thecarapiRecords: [record], photoGroups: [] } });
    const key = auctionLotRecordKey(record);
    const photos = [{ id: "copy1", auctionKey: key, date: "2026-10-09", caption: "", sourceUrl: D2 }];
    const parts = buildAuctionLotsHtml({ summary, records: [record], photos, dataUrls: new Map([["copy1", "data:C1"]]) });
    const lot = parts.lots.join("");
    const li = lot.split("<li").find((x) => x.includes("Trūkst")) ?? "";
    expect(li).toContain('<img src="data:C1"');
  });
});

describe("bojājumu bildes: admins", () => {
  it("bojājuma bildes -> indeksi ieraksta bilžu sarakstā (lightbox)", () => {
    const photos = [photo("a", MAIN), photo("b", D2), photo("c", D1)];
    expect(thecarapiDamagePhotoIndexes(dmg({ photoUrls: [D1, D2, "https://nav.saglabata/x.jpg"] }), photos)).toEqual([2, 1]);
    expect(thecarapiDamagePhotoIndexes(dmg({}), photos)).toEqual([]);
  });
});
