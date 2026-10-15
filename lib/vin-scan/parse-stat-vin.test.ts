import { describe, expect, it } from "vitest";

import {
  classifyStatVinText,
  extractStatVinPhotoUrls,
  formatStatVinFoundSummary,
  isStatVinNotFoundUrl,
  parseStatVinPage,
} from "@/lib/vin-scan/parse-stat-vin";

/** Live datacenter response 2026-10-14: Cloudflare WAF, not a JS interstitial. */
const STAT_VIN_WAF_403 = "Access blocked, contact us at support@stat.vin A";

const CAR_NOT_FOUND_HTML = `<!doctype html><html><body>
  <h1>Car not found</h1>
  <p>We couldn't find a vehicle with this VIN. Redirected to /car-not-found.</p>
</body></html>`;

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
    expect((r.media?.photoUrls?.length ?? 0) >= 1).toBe(true);
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

  it("stat.vin WAF 403 (Access blocked) ir error, ne none", () => {
    const r = parseStatVinPage({ status: 403, html: STAT_VIN_WAF_403, vin: VIN });
    expect(r.status).toBe("unknown");
    expect(r.summary).toMatch(/Cloudflare/i);
    expect(r.summary).not.toMatch(/nav izsoles/i);
  });

  it("car-not-found redirect ir none, ne found un ne error", () => {
    expect(isStatVinNotFoundUrl("https://stat.vin/car-not-found")).toBe(true);
    expect(isStatVinNotFoundUrl("https://stat.vin/car-not-found?ref=1")).toBe(true);
    expect(isStatVinNotFoundUrl(`https://stat.vin/cars/${VIN}`)).toBe(false);
    const byUrl = parseStatVinPage({
      status: 200,
      html: "<html><body>Popular cars</body></html>",
      vin: VIN,
      finalUrl: "https://stat.vin/car-not-found",
    });
    expect(byUrl.status).toBe("none");
    expect(byUrl.summary).toBe("Nav izsoles ieraksta");
    const byHtml = parseStatVinPage({ status: 200, html: CAR_NOT_FOUND_HTML, vin: VIN });
    expect(byHtml.status).toBe("none");
  });

  it("found paliek found tikai ar izsoles ierakstu", () => {
    const r = parseStatVinPage({ status: 200, html: FOUND_HTML, vin: VIN, finalUrl: `https://stat.vin/cars/${VIN}` });
    expect(r.status).toBe("found");
    expect(r.auctions?.length).toBeGreaterThan(0);
    expect((r.media?.photoCount ?? 0) >= 1).toBe(true);
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
    expect(
      classifyStatVinText("Popular auction cars this week. Browse featured lots and photos from recent sales.", VIN),
    ).toEqual({ status: "unknown", summary: "stat.vin: lapa bez VIN un bez „nav atrasts”" });
    expect(classifyStatVinText("Page not found", VIN)?.status).toBe("none");
    expect(classifyStatVinText("Car not found", VIN)?.status).toBe("none");
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
