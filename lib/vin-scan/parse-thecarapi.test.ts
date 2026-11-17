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

  it("tukšs saraksts ir none", () => {
    const { parse, refs } = parseThecarapiHistory({ json: fixture("history-empty.json") });
    expect(parse.status).toBe("none");
    expect(parse.summary).toBe("nav ierakstu");
    expect(refs).toEqual([]);
  });
});

describe("parseThecarapiDetail", () => {
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
