import { describe, expect, it } from "vitest";

import {
  classifyStatVinText,
  extractStatVinPhotoUrls,
  formatStatVinFoundSummary,
  parseStatVinPage,
} from "@/lib/vin-scan/parse-stat-vin";

const VIN = "WBA5R1C0XLFH42873";

const FOUND_HTML = `<!doctype html><html><body>
  <h1>RAM 2500 2026 VIN: ${VIN}</h1>
  <p>Sale History (13) Auction Date Final Bid Copart</p>
  <p>Lot: 50558298 Damage: Front End Odometer 185389</p>
  <img src="https://cs.copart.com/v1/auth/img/lot/50558298/1.jpg">
  <img src="https://cs.copart.com/v1/auth/img/lot/50558298/2.jpg">
</body></html>`;

const NONE_HTML = `<html><body>
  <p>Search… No results. Popular cars: No similar cars were found at the auction.
  2021 BMW 330I Lot: 45129191</p>
</body></html>`;

const CF_HTML = `<html><body>Just a moment... Checking your browser</body></html>`;

describe("parseStatVinPage", () => {
  it("nolasa Copart ierakstu, lotu un foto URL", () => {
    const r = parseStatVinPage({ status: 200, html: FOUND_HTML, vin: VIN });
    expect(r.status).toBe("found");
    expect(r.summary).toMatch(/Copart/i);
    expect(r.summary).toMatch(/foto/i);
    expect(r.auctions?.some((row) => row.venue === "Copart")).toBe(true);
    expect(r.media?.photoUrl).toContain("copart.com");
    expect((r.media?.photoCount ?? 0) >= 2).toBe(true);
  });

  it("tukša lapa bez šī VIN ir none", () => {
    expect(parseStatVinPage({ status: 200, html: NONE_HTML, vin: VIN }).status).toBe("none");
    expect(parseStatVinPage({ status: 404, html: "", vin: VIN }).status).toBe("none");
  });

  it("Cloudflare un 429 ir skaidrs unknown, nevis „Lapa nav atpazīta”", () => {
    const cf = parseStatVinPage({ status: 403, html: CF_HTML, vin: VIN, challenge: "Cloudflare palika lapā" });
    expect(cf.status).toBe("unknown");
    expect(cf.summary).toMatch(/Cloudflare/i);
    expect(cf.summary).not.toMatch(/nav atpazīta/i);

    const rate = parseStatVinPage({ status: 429, html: "Too many requests", vin: VIN });
    expect(rate.status).toBe("unknown");
    expect(rate.summary).toMatch(/limits/i);

    const blocked = parseStatVinPage({ status: 403, html: "Forbidden", vin: VIN });
    expect(blocked.status).toBe("unknown");
    expect(blocked.summary).toMatch(/403/);
  });

  it("nolasa Next.js __NEXT_DATA__ izsoles masīvu", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          car: {
            vin: VIN,
            saleHistory: [
              {
                auction: "IAAI",
                lotNumber: "7788123",
                saleDate: "2025-03-11",
                primaryDamage: "Rear",
                odometer: 92000,
                photos: ["https://vis.iaai.com/lots/7788123/a.jpg"],
              },
            ],
          },
        },
      },
    })}</script><div>VIN: ${VIN} Auction IAAI</div>`;
    const r = parseStatVinPage({ status: 200, html, vin: VIN });
    expect(r.status).toBe("found");
    expect(r.summary).toMatch(/IAAI/);
    expect(r.auctions?.[0]?.venue).toBe("IAAI");
    expect(r.auctions?.[0]?.title).toMatch(/7788123/);
  });
});

describe("classifyStatVinText", () => {
  it("Cloudflare vēl nav rezultāts; limits un none ir skaidri", () => {
    expect(classifyStatVinText("Just a moment...", VIN)).toBeNull();
    expect(classifyStatVinText("Too many requests. Try again later.", VIN)).toEqual({
      status: "unknown",
      summary: "stat.vin: pieprasījumu limits",
    });
    expect(classifyStatVinText("Page not found", VIN)?.status).toBe("none");
    expect(
      classifyStatVinText(`RAM 2500 2026 VIN: ${VIN} Sale History (13) Auction Date Final Bid Copart`, VIN)?.status,
    ).toBe("found");
  });
});

describe("extractStatVinPhotoUrls / formatStatVinFoundSummary", () => {
  it("ņem izsoļu foto un izlaiž logo", () => {
    const urls = extractStatVinPhotoUrls(
      `<img src="/logo.png"><img src="https://cs.copart.com/v1/auth/img/lot/1/1.jpg">`,
    );
    expect(urls.some((u) => u.includes("copart.com"))).toBe(true);
    expect(urls.every((u) => !u.includes("logo.png"))).toBe(true);
  });

  it("kopsavilkums: Copart 2025, 20 foto", () => {
    expect(formatStatVinFoundSummary([{ title: "Copart", venue: "Copart", date: "2025-09-02" }], 20)).toBe(
      "Copart 2025, 20 foto",
    );
  });
});
