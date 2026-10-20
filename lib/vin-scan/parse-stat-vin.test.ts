import { describe, expect, it } from "vitest";

import { milesToKmRounded } from "@/lib/miles-to-km";
import {
  classifyStatVinText,
  extractStatVinPhotoUrls,
  formatStatVinFoundSummary,
  formatStatVinOdometerKm,
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

  it("WDD1173421N570488: Copart FI lots 50558298 un 20 foto, arī ja navigācija palika HTTP 403", () => {
    const vin = "WDD1173421N570488";
    const imgs = Array.from({ length: 20 }, (_, i) => `<img src="https://cs.copart.com/v1/auth/img/lot/50558298/${i + 1}.jpg">`).join("");
    const html = `<!doctype html><html><body>
      <h1>Mercedes-Benz CLA VIN: ${vin}</h1>
      <p>Sale History Copart FI Finland</p>
      <p>Lot: 50558298</p>
      <p>20 photos</p>
      ${imgs}
    </body></html>`;
    const r = parseStatVinPage({ status: 403, html, vin, finalUrl: `https://stat.vin/cars/${vin}` });
    expect(r.status).toBe("found");
    expect(r.summary).toContain("Copart FI");
    expect(r.summary).toContain("20 foto");
    expect(r.auctions?.[0]?.venue).toBe("Copart FI");
    expect(r.auctions?.[0]?.title).toContain("50558298");
    expect(r.media?.photoCount).toBe(20);
    expect(r.media?.photoUrls).toHaveLength(20);
    expect(r.summary).not.toMatch(/403/);
  });

  it("katra izsole atsevišķi: datums, km, bojājums, cena, vieta, lots un foto", () => {
    const html = `<html><body>
      <h1>VIN: ${VIN}</h1>
      <section>
        Copart Lot: 11111111 Sale date: 2024-01-02 Final bid: $1,100 Odometer: 10000 Damage: Front End Location: Houston, TX
        <img src="https://cs.copart.com/v1/auth/img/lot/11111111/1.jpg">
        <img src="https://cs.copart.com/v1/auth/img/lot/11111111/2.jpg">
      </section>
      <section>
        IAAI Lot: 22222222 Sale date: 2023-05-09 Final bid: $2,200 Odometer: 80000 Damage: Rear Location: Dallas, TX
        <img src="https://vis.iaai.com/resizer?imageKeys=22222222~1&width=400">
        <img src="https://vis.iaai.com/resizer?imageKeys=22222222~2&width=400">
      </section>
    </body></html>`;
    const r = parseStatVinPage({ status: 200, html, vin: VIN });
    expect(r.status).toBe("found");
    expect(r.auctions).toHaveLength(2);
    expect(r.auctions?.[0]).toMatchObject({
      venue: "Copart",
      lot: "11111111",
      date: "2024-01-02",
      damage: "Front End",
    });
    expect(r.auctions?.[0]?.price).toMatch(/1[,.]?100/);
    expect(r.auctions?.[0]?.odometer).toMatch(/km/);
    expect(r.auctions?.[0]?.photoUrls?.every((url) => url.includes("11111111"))).toBe(true);
    expect(r.auctions?.[1]).toMatchObject({
      venue: "IAAI",
      lot: "22222222",
      date: "2023-05-09",
      damage: "Rear",
    });
    expect(r.auctions?.[1]?.price).toMatch(/2[,.]?200/);
    expect(r.auctions?.[1]?.photoUrls?.every((url) => url.includes("22222222"))).toBe(true);
    expect(r.mileage?.map((row) => row.odometer).every((km) => /km/.test(km))).toBe(true);
    expect(r.media?.photoUrls?.length).toBe(4);
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

  it("2026-10 kartīte: Lot number, Odometer mi → km, JSON-LD foto; Sale History (0) nav none", () => {
    const vin = "WDD1173421N570488";
    const photo =
      "https://g-static.copart.com/v1/AUTH_svc_depdoc/ids-g-prod-top1-pub-perm/0925/ee075ec6ac3c4781baa99672ef0b7ba0_O_2.jpg";
    const html = `<!doctype html><html><body>
      <h1>Mercedes-Benz CLA 2017 VIN: ${vin}</h1>
      <p>Copart</p>
      <p>Sale History (0)</p>
      <p>Auction completed</p>
      <p>20 Photos</p>
      <p>AI damage report</p>
      <p>Auction: COPART FINLAND</p>
      <p>Lot number: 50558298</p>
      <p>VIN: ${vin}</p>
      <p>Location: Turku</p>
      <p>Damage: Front End</p>
      <p>Odometer, mi: 185,389 mi</p>
      <p>Keys: N/A</p>
      <table><tr><td>No data found</td></tr></table>
      <p>No similar cars were found at the auction.</p>
      <img src="${photo}">
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Vehicle",
        vehicleIdentificationNumber: vin,
        knownVehicleDamages: "Front End",
        purchaseDate: "2025-09-24 10:51:58",
        description:
          "Vehicle Mercedes-Benz CLA 2017 was sold on at COPART FINLAND auction, lot number 50558298, with Front End damage. It was purchased for , with a mileage of 185389 miles at the time of sale.",
        image: [photo],
        manufacturer: "Mercedes-Benz",
        model: "CLA",
        productionDate: "2017",
      })}</script>
    </body></html>`;
    const r = parseStatVinPage({ status: 200, html, vin, finalUrl: `https://stat.vin/cars/${vin}` });
    expect(r.status).toBe("found");
    expect(r.summary).not.toMatch(/nav izsoles/i);
    expect(r.auctions?.[0]?.lot).toBe("50558298");
    expect(r.auctions?.[0]?.venue).toBe("Copart FI");
    expect(r.auctions?.[0]?.odometer).toBe(formatStatVinOdometerKm("185389 mi"));
    expect((r.auctions?.[0]?.odometer || "").replace(/[^\d]/g, "")).toBe(String(milesToKmRounded(185389)));
    expect(r.auctions?.[0]?.odometer).toMatch(/km/);
    expect(r.mileage?.[0]?.odometer).toMatch(/km/);
    expect(r.media?.photoUrl).toContain("g-static.copart.com");
    expect(r.vehicle?.make).toMatch(/Mercedes/i);
    expect(`${r.summary}\n${r.detail ?? ""}\n${r.auctions?.[0]?.title ?? ""}`).not.toMatch(/\bkeys?\b/i);
    expect(classifyStatVinText(html.replace(/<[^>]+>/g, " "), vin)?.status).toBe("found");
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

describe("formatStatVinOdometerKm", () => {
  it("mi pārvērš km; bez vienības atstāj skaitli kā km", () => {
    expect(formatStatVinOdometerKm("185,389 mi").replace(/[^\d]/g, "")).toBe(String(milesToKmRounded(185389)));
    expect(formatStatVinOdometerKm("185389").replace(/[^\d]/g, "")).toBe("185389");
    expect(formatStatVinOdometerKm("")).toBe("");
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
