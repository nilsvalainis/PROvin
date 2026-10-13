import { describe, expect, it } from "vitest";
import { parseAuctionArchive } from "@/lib/vin-scan/parse-extra";

const VIN = "WAUZZZF50NA041246";

describe("parseAuctionArchive", () => {
  it("AucHistory sākumlapa: VIN tikai skriptā + featured cars → Nav", () => {
    const imgs = Array.from({ length: 70 }, (_, i) => `<img src="/p${i}.jpg">`).join("");
    const html = `<html><script>var current_url="https://auchistory.com/?vin=${VIN}";</script>
      <h2>Latest Featured Cars</h2><div>Auction lot 123 WBA1234567890ABCD sold, damage front, 12 photos</div>${imgs}</html>`;
    const r = parseAuctionArchive(200, html, VIN, "AucHistory");
    expect(r.status).toBe("none");
  });
  it("VIN redzamajā tekstā ar lota datiem → found", () => {
    const html = `<div><h1>Audi ${VIN}</h1><p>Copart lot 555, damage: rear, 15 photos</p></div>`;
    const r = parseAuctionArchive(200, html, VIN, "AucHistory");
    expect(r.status).toBe("found");
    expect(r.summary).toContain("15 foto");
  });
  it("403 → unknown ar HTTP kodu", () => {
    expect(parseAuctionArchive(403, "", VIN, "BidFax").status).toBe("unknown");
  });
});
