import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isAllowedVinScanAuctionPhotoUrl } from "@/lib/order-vin-scan-photos";
import {
  mergeThecarapiDetails,
  parseThecarapiDetail,
  parseThecarapiHistory,
} from "@/lib/vin-scan/parse-thecarapi";

function fixture(name: string): unknown {
  const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi", name);
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

describe("parseThecarapiHistory", () => {
  it("saliek auto1 un openlane jaunāko pirmo", () => {
    const { parse, refs } = parseThecarapiHistory({ json: fixture("history-hit.json") });
    expect(parse.status).toBe("found");
    expect(parse.auctions).toHaveLength(2);
    expect(parse.auctions?.[0]).toMatchObject({
      date: "2024-06-02",
      venue: "Openlane",
      lot: "OL-55",
      odometer: "190 100 km",
      price: "9 100 EUR",
    });
    expect(parse.auctions?.[1]).toMatchObject({
      date: "2024-03-15",
      venue: "AUTO1",
      lot: "A1-100",
      odometer: "185 389 km",
      price: "8 200 EUR",
    });
    expect(parse.detail).toContain("/api/auction/openlane/OL-55");
    expect(parse.detail).toContain("https://api.thecarapi.com/api/auction/openlane/OL-55");
    expect(parse.detail).toContain("https://api.thecarapi.com/api/auction/auto1/A1-100");
    expect(parse.openUrl).toBe("https://api.thecarapi.com/api/auction/openlane/OL-55");
    expect(refs.map((ref) => `${ref.site}:${ref.id}`)).toEqual(["openlane:OL-55", "auto1:A1-100"]);
  });

  it("skaitlisks auction_id (reālā atbilde) dod izsoles ID un detaļu ref", () => {
    const json = {
      auctions: [
        {
          site_name: "auto1",
          auction_id: 1326383403,
          mileage: 226760,
          public_price_eur: 11379,
          last_seen_at: "2026-10-09T15:41:18.230176",
          detail_path: "/api/auction/auto1/1326383403",
        },
      ],
    };
    const { parse, refs } = parseThecarapiHistory({ json });
    expect(refs).toEqual([{ site: "auto1", id: "1326383403", active: false }]);
    expect(parse.auctions?.[0]?.lot).toBe("1326383403");
  });

  it("tukšs saraksts ir none", () => {
    const { parse, refs } = parseThecarapiHistory({ json: fixture("history-empty.json") });
    expect(parse.status).toBe("none");
    expect(parse.summary).toBe("nav ierakstu");
    expect(refs).toEqual([]);
  });
});

describe("parseThecarapiDetail", () => {
  it("atver reālo ietinumu {auction} un lasa visus bilžu laukus", () => {
    const detail = parseThecarapiDetail(fixture("detail-auto1-envelope-simple.json"));
    expect(detail.site).toBe("auto1");
    expect(detail.id).toBe("A1-200");
    expect(detail.pending).toBe(false);
    expect(detail.photoUrls).toEqual(
      expect.arrayContaining([
        "https://img-pa.auto1.com/img/w-main.jpg",
        "https://img-pa.auto1.com/img/w-damage.jpg",
        "https://img-pa.auto1.com/img/w-service.jpg",
        "https://img-pa.auto1.com/img/w-vault.jpg",
        "https://img-pa.auto1.com/img/w-sub.jpg",
      ]),
    );
  });

  it("patur tikai atļautās https fotogrāfijas un aprīkojumu", () => {
    const detail = parseThecarapiDetail(fixture("detail-auto1.json"));
    expect(detail.site).toBe("auto1");
    expect(detail.id).toBe("A1-100");
    expect(detail.pending).toBe(false);
    expect(detail.photoUrls).toEqual([
      "https://img-pa.auto1.com/img/front.jpg",
      "https://img-pa.auto1.com/img/side.jpg",
    ]);
    expect(detail.equipment).toEqual(["Navigācija", "LED"]);
    expect(isAllowedVinScanAuctionPhotoUrl("https://img-pa.auto1.com/img/front.jpg")).toBe(true);
    expect(isAllowedVinScanAuctionPhotoUrl("http://img-pa.auto1.com/img/insecure.jpg")).toBe(false);
  });

  it("pieliek foto un aprīkojumu vēstures rindām", () => {
    const history = parseThecarapiHistory({ json: fixture("history-hit.json") });
    const merged = mergeThecarapiDetails(history.parse, [parseThecarapiDetail(fixture("detail-auto1.json"))]);
    const auto1 = merged.auctions?.find((row) => row.lot === "A1-100");
    expect(auto1?.photoUrls).toEqual([
      "https://img-pa.auto1.com/img/front.jpg",
      "https://img-pa.auto1.com/img/side.jpg",
    ]);
    expect(merged.detail).toContain("Aprīkojums: A1-100: Navigācija, A1-100: LED");
  });
});
