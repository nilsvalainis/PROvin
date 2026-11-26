import { describe, expect, it } from "vitest";

import { buildOrderVinScanSummary, type OrderVinScanRecord } from "@/lib/order-vin-scan";
import {
  ORDER_VIN_SCAN_BROWSER_HTML_MAX,
  applyBrowserArchiveHtml,
  preferBrowserArchiveImport,
  safeBrowserImportOpenUrl,
} from "@/lib/order-vin-scan-browser-html";

const VIN = "WBA5R1C0XLFH42873";
const OTHER = "WAUZZZF50NA041246";

function record(indicators: OrderVinScanRecord["indicators"] = []): OrderVinScanRecord {
  return {
    at: "2026-10-14T09:00:00.000Z",
    vin: VIN,
    status: "done",
    indicators,
  };
}

const blockedStat = {
  id: "stat_vin" as const,
  label: "stat.vin",
  country: "US",
  status: "unknown" as const,
  summary: "stat.vin: Cloudflare bloķē servera pārbaudi",
  detail: "",
  openUrl: `https://stat.vin/cars/${VIN}`,
};

const STAT_HTML = `<!doctype html><html><body>
  <h1>RAM 2500 2026 VIN: ${VIN}</h1>
  <p>Sale History (13) Auction Date Final Bid Copart</p>
  <p>Lot: 50558298</p>
  <p>Location: Houston, TX</p>
  <p>Sale date: 2025-09-02</p>
  <p>Final bid: $5,200</p>
  <p>Odometer: 185389</p>
  <p>Damage: Front End</p>
  <img src="https://cs.copart.com/v1/auth/img/lot/50558298/1.jpg">
  <img src="https://cs.copart.com/v1/auth/img/lot/50558298/2.jpg">
</body></html>`;

describe("pārlūka arhīva HTML imports", () => {
  it("2026-10 stat.vin kartīte saglabā lotu, km no jūdzēm un g-static foto", () => {
    const vin = "WDD1173421N570488";
    const photo =
      "https://g-static.copart.com/v1/AUTH_svc_depdoc/ids-g-prod-top1-pub-perm/0925/ee075ec6ac3c4781baa99672ef0b7ba0_O_2.jpg";
    const html = `<!doctype html><html><body>
      <h1>Mercedes-Benz CLA VIN: ${vin}</h1>
      <p>Sale History (0) Auction completed Copart</p>
      <p>Lot number: 50558298</p>
      <p>Location: Turku</p>
      <p>Damage: Front End</p>
      <p>Odometer, mi: 185,389 mi</p>
      <p>Keys: N/A</p>
      <p>No similar cars were found at the auction.</p>
      <img src="${photo}">
    </body></html>`;
    const applied = applyBrowserArchiveHtml({
      record: { at: "2026-10-20T09:00:00.000Z", vin, status: "done", indicators: [] },
      id: "stat_vin",
      html,
      pageUrl: `https://stat.vin/cars/${vin}`,
      vin,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const row = applied.record.indicators.find((item) => item.id === "stat_vin");
    expect(row?.status).toBe("found");
    expect(row?.auctions?.[0]?.lot).toBe("50558298");
    expect(row?.auctions?.[0]?.odometer).toMatch(/km/);
    expect(row?.auctions?.[0]?.odometer).not.toMatch(/\bmi\b/);
    expect(row?.media?.photoUrl).toContain("g-static.copart.com");
    expect(`${row?.summary ?? ""}\n${row?.detail ?? ""}`).not.toMatch(/\bkeys?\b/i);
  });

  it("stat.vin lapa saglabā foto, lotu, vietu, cenu un km; poga ir Ielikt AUCTION", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([blockedStat]),
      id: "stat_vin",
      html: STAT_HTML,
      pageUrl: `https://stat.vin/cars/${VIN}`,
      vin: VIN,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const row = applied.record.indicators.find((item) => item.id === "stat_vin");
    expect(row?.status).toBe("found");
    expect(row?.media?.photoUrl).toContain("copart.com");
    expect(row?.media?.photoUrls?.length).toBeGreaterThanOrEqual(2);
    expect(row?.auctions?.[0]?.title).toMatch(/50558298/);
    expect(row?.auctions?.[0]?.title).toMatch(/Houston/);
    expect(row?.auctions?.[0]?.venue).toBe("Copart");
    expect(row?.auctions?.[0]?.price).toMatch(/5[,.]?200/);
    expect(row?.auctions?.[0]?.date).toBeTruthy();
    expect(row?.mileage?.[0]?.odometer).toMatch(/km/);
    const sum = buildOrderVinScanSummary(applied.record);
    const stat = sum?.rows.find((item) => item.id === "stat_vin");
    expect(stat?.action).toBe("import_auction");
    expect(stat?.canImportAuction).toBe(true);
    expect(stat?.photoUrls.some((url) => url.includes("copart.com"))).toBe(true);
  });

  it("stat.vin bez ieraksta ir none un nodzēš vecos foto", () => {
    const prev = record([
      {
        ...blockedStat,
        status: "found",
        summary: "Copart",
        media: { photoUrl: "https://cs.copart.com/old.jpg", photoUrls: ["https://cs.copart.com/old.jpg"] },
        auctions: [{ title: "Copart", venue: "Copart" }],
      },
    ]);
    const applied = applyBrowserArchiveHtml({
      record: prev,
      id: "stat_vin",
      html: "<html><body><h1>Car not found</h1><p>We couldn't find a vehicle.</p></body></html>",
      pageUrl: `https://stat.vin/car-not-found`,
      vin: VIN,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const row = applied.record.indicators[0];
    expect(row?.status).toBe("none");
    expect(row?.summary).toBe("Nav izsoles ieraksta");
    expect(row?.media).toBeUndefined();
    expect(row?.auctions).toEqual([]);
    expect(buildOrderVinScanSummary(applied.record)?.rows.find((item) => item.id === "stat_vin")?.action).not.toBe(
      "import_auction",
    );
  });

  it("cita VIN lapa netiek saglabāta", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([blockedStat]),
      id: "stat_vin",
      html: `<html><body><h1>${OTHER}</h1><p>Copart auction lot 12345678 odometer 10000</p></body></html>`,
      pageUrl: `https://stat.vin/cars/${OTHER}`,
      vin: VIN,
    });
    expect(applied).toEqual({ ok: false, error: "vin_mismatch" });
  });

  it("2026-11 heša fragments skriptā nav VIN (nav vin_mismatch)", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([blockedStat]),
      id: "stat_vin",
      html: `${STAT_HTML}<script src="main.c968a041fe49804bed66.js"></script><script src="runtime.05f815d1e0d5dc5061df.js"></script>`,
      pageUrl: `https://stat.vin/cars/${VIN}`,
      vin: VIN,
    });
    expect(applied.ok).toBe(true);
  });

  it("2026-11 biluppgifter.se 404 ar citu auto saitēm = nav reģistrā, nevis vin_mismatch", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([]),
      id: "biluppgifter",
      html: `<html><body><h1>Sidan kunde inte hittas</h1><a href="/fordon/${OTHER}/">${OTHER}</a></body></html>`,
      pageUrl: `https://biluppgifter.se/${VIN}/`,
      vin: VIN,
      httpStatus: 404,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.record.indicators.find((row) => row.id === "biluppgifter")?.status).toBe("none");
  });

  it("biluppgifter.se 200 ar citu VIN joprojām ir vin_mismatch", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([]),
      id: "biluppgifter",
      html: `<html><body><h1>Volkswagen Golf</h1><p>Chassinummer: ${OTHER}</p></body></html>`,
      pageUrl: `https://biluppgifter.se/${VIN}/`,
      vin: VIN,
      httpStatus: 200,
    });
    expect(applied).toEqual({ ok: false, error: "vin_mismatch" });
  });

  it("pārāk gara lapa tiek noraidīta", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([blockedStat]),
      id: "stat_vin",
      html: `${VIN}${"x".repeat(ORDER_VIN_SCAN_BROWSER_HTML_MAX)}`,
      pageUrl: `https://stat.vin/cars/${VIN}`,
      vin: VIN,
    });
    expect(applied).toEqual({ ok: false, error: "too_large" });
  });

  it("stat.vin pieprasījumu limits paliek kopsavilkumā", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([blockedStat]),
      id: "stat_vin",
      html: "<html><body>Too many requests. Try again later.</body></html>",
      pageUrl: `https://stat.vin/cars/${VIN}`,
      vin: VIN,
      httpStatus: 429,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const row = applied.record.indicators.find((item) => item.id === "stat_vin");
    expect(row?.status).toBe("unknown");
    expect(row?.summary).toMatch(/pieprasījumu limits/);
    expect(row?.summary).not.toMatch(/403/);
  });

  it("Cloudflare lapa nepaliek kā found vai none", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([blockedStat]),
      id: "stat_vin",
      html: "<html><body>Just a moment... Checking your browser</body></html>",
      pageUrl: `https://stat.vin/cars/${VIN}`,
      vin: VIN,
    });
    expect(applied).toEqual({ ok: false, error: "page_not_ready" });
  });

  it("bidfax, poctra un bid.cars lieto izsoļu arhīva parseri", () => {
    const html = `<div><h1>Audi ${VIN}</h1><p>Copart lot 555, damage: rear, 15 photos</p>
      <img src="https://bidfax.info/photos/1.jpg"></div>`;
    for (const id of ["bidfax", "poctra", "bid_cars"] as const) {
      const applied = applyBrowserArchiveHtml({
        record: record([
          {
            id,
            label: id,
            country: "US",
            status: "unknown",
            summary: "Cloudflare",
            detail: "",
            openUrl: "https://example.test/",
          },
        ]),
        id,
        html,
        pageUrl: `https://example.test/?vin=${VIN}`,
        vin: VIN,
      });
      expect(applied.ok, id).toBe(true);
      if (!applied.ok) continue;
      expect(applied.record.indicators[0]?.status).toBe("found");
      expect(applied.record.indicators[0]?.summary).toMatch(/izsol/i);
      expect(applied.record.indicators[0]?.media?.photoUrl).toContain("bidfax.info");
    }
  });

  it("tukšs bid.cars meklējums ir none", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([]),
      id: "bid_cars",
      html: `<html><body><p>${VIN}</p><p>No results. Nothing found.</p></body></html>`,
      pageUrl: `https://bid.cars/en/search?q=${VIN}`,
      vin: VIN,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.record.indicators[0]?.status).toBe("none");
  });

  it("plc.auction saglabā datumu, vietu, cenu un nobraukumu", () => {
    const html = `<div>
      <h1>SKODA SUPERB, 2012 (LOT №: 111)</h1>
      <p>${VIN}</p>
      <p>Location: LV, Riga</p>
      <p>Sale date: 2024-01-02</p>
      <p>Winning bid: 3200 USD</p>
      <p>Mileage: 180000 km</p>
    </div>`;
    const applied = applyBrowserArchiveHtml({
      record: record([]),
      id: "plc_auction",
      html,
      pageUrl: `https://plc.auction/?vin=${VIN}`,
      vin: VIN,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const row = applied.record.indicators[0];
    expect(row?.status).toBe("found");
    expect(row?.auctions?.[0]?.date).toMatch(/2024-01-02/);
    expect(row?.auctions?.[0]?.venue).toMatch(/Riga/);
    expect(row?.auctions?.[0]?.price).toMatch(/3200/);
    expect(row?.auctions?.[0]?.title).toMatch(/111/);
    expect(row?.mileage?.[0]?.odometer).toMatch(/180/);
  });

  it("checkcar.vin importē statusu", () => {
    const found = applyBrowserArchiveHtml({
      record: record([]),
      id: "checkcar_vin",
      html: `<div>${VIN} auction gallery 4 photos</div>`,
      pageUrl: `https://checkcar.vin/report/check/${VIN}`,
      vin: VIN,
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.record.indicators[0]?.status).toBe("found");
    expect(found.record.indicators[0]?.summary).toBe("4 foto");

    const none = applyBrowserArchiveHtml({
      record: record([]),
      id: "checkcar_vin",
      html: "<div>No photos available</div>",
      pageUrl: `https://checkcar.vin/report/check/${VIN}`,
      vin: VIN,
    });
    expect(none.ok).toBe(true);
    if (!none.ok) return;
    expect(none.record.indicators[0]?.status).toBe("none");
  });

  it("CARFAX un NICB HTML no pārlūka kļūst par found vai none; izņemtā epolicija.lt - nē", () => {
    const carfax = applyBrowserArchiveHtml({
      record: record([]),
      id: "carfax_eu",
      html: `<html><body>We found 3 records for ${VIN}</body></html>`,
      pageUrl: `https://www.carfax.eu/preview-page?vin=${VIN}`,
      vin: VIN,
    });
    expect(carfax.ok).toBe(true);
    if (!carfax.ok) return;
    expect(carfax.record.indicators[0]?.status).toBe("found");

    const nicb = applyBrowserArchiveHtml({
      record: record([]),
      id: "nicb",
      html: `<html><body>${VIN} clean record</body></html>`,
      pageUrl: `https://www.nicb.org/vincheck?vin=${VIN}`,
      vin: VIN,
    });
    expect(nicb.ok).toBe(true);
    if (!nicb.ok) return;
    expect(nicb.record.indicators[0]?.status).toBe("none");

    const police = applyBrowserArchiveHtml({
      record: record([]),
      id: "lt_itpr",
      html: `<html><body>Duomenų nerasta ${VIN}</body></html>`,
      pageUrl: `https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=${VIN}`,
      vin: VIN,
    });
    expect(police.ok).toBe(false);
  });

  it("servera unknown nepārraksta jau importētu pārlūka rezultātu", () => {
    const imported = {
      id: "stat_vin" as const,
      label: "stat.vin",
      country: "US",
      status: "found" as const,
      summary: "Copart, 2 foto",
      detail: "",
      openUrl: `https://stat.vin/cars/${VIN}`,
      auctions: [{ title: "Copart · lots 50558298", venue: "Copart", date: "2025" }],
      media: { photoUrl: "https://cs.copart.com/a.jpg", photoUrls: ["https://cs.copart.com/a.jpg"] },
    };
    const serverUnknown = { ...imported, status: "unknown" as const, summary: "Cloudflare", auctions: [], media: undefined };
    const kept = preferBrowserArchiveImport([imported], [serverUnknown, { ...imported, id: "tjekbil", status: "none", summary: "Nav" }]);
    expect(kept.find((row) => row.id === "stat_vin")?.status).toBe("found");
    expect(kept.find((row) => row.id === "stat_vin")?.media?.photoUrl).toContain("copart.com");
    expect(kept.find((row) => row.id === "tjekbil")?.status).toBe("none");
    const serverFound = preferBrowserArchiveImport(
      [{ ...imported, status: "none", summary: "Nav izsoles ieraksta", auctions: [], media: undefined }],
      [{ ...imported, summary: "Copart no servera" }],
    );
    expect(serverFound[0]?.status).toBe("found");
    expect(serverFound[0]?.summary).toBe("Copart no servera");
  });

  it("maksas avots netiek importēts", () => {
    const applied = applyBrowserArchiveHtml({
      record: record([]),
      id: "carvertical_preview",
      html: `<div>${VIN} we found information</div>`,
      pageUrl: "https://www.carvertical.com/",
      vin: VIN,
    });
    expect(applied).toEqual({ ok: false, error: "unsupported" });
  });
});

describe("safeBrowserImportOpenUrl (klienta pageUrl -> openUrl)", () => {
  const catalog = `https://stat.vin/cars/${VIN}`;

  it("patur https saiti uz avota saimnieku un tā apakšdomēnu", () => {
    expect(safeBrowserImportOpenUrl("stat_vin", `https://stat.vin/cars/${VIN}?tab=1`, VIN)).toBe(
      `https://stat.vin/cars/${VIN}?tab=1`,
    );
    expect(safeBrowserImportOpenUrl("stat_vin", `https://en.stat.vin/cars/${VIN}`, VIN)).toBe(
      `https://en.stat.vin/cars/${VIN}`,
    );
    // Katalogā www.nicb.org: bez www un apakšdomēns arī der.
    expect(safeBrowserImportOpenUrl("nicb", "https://nicb.org/vincheck", VIN)).toBe("https://nicb.org/vincheck");
  });

  it("javascript:, http: un svešs saimnieks krīt uz kataloga saiti", () => {
    expect(safeBrowserImportOpenUrl("stat_vin", "javascript:alert(1)", VIN)).toBe(catalog);
    expect(safeBrowserImportOpenUrl("stat_vin", `http://stat.vin/cars/${VIN}`, VIN)).toBe(catalog);
    expect(safeBrowserImportOpenUrl("stat_vin", `https://evil.example/cars/${VIN}`, VIN)).toBe(catalog);
    expect(safeBrowserImportOpenUrl("stat_vin", `https://stat.vin.evil.example/cars/${VIN}`, VIN)).toBe(catalog);
    expect(safeBrowserImportOpenUrl("stat_vin", `https://evilstat.vin/cars/${VIN}`, VIN)).toBe(catalog);
    expect(safeBrowserImportOpenUrl("stat_vin", "nav saite", VIN)).toBe(catalog);
    expect(safeBrowserImportOpenUrl("stat_vin", "", VIN)).toBe(catalog);
  });

  it("imports saglabā kataloga saiti, ja klients sūta svešu vai javascript: pageUrl", () => {
    for (const pageUrl of ["javascript:alert(document.cookie)", `http://stat.vin/cars/${VIN}`, `https://evil.example/cars/${VIN}`]) {
      const applied = applyBrowserArchiveHtml({ record: record([]), id: "stat_vin", html: STAT_HTML, pageUrl, vin: VIN });
      expect(applied.ok, pageUrl).toBe(true);
      if (!applied.ok) continue;
      expect(applied.record.indicators[0]?.openUrl, pageUrl).toBe(catalog);
    }
  });

  it("imports saglabā derīgu apakšdomēna pageUrl", () => {
    const pageUrl = `https://en.stat.vin/cars/${VIN}`;
    const applied = applyBrowserArchiveHtml({ record: record([]), id: "stat_vin", html: STAT_HTML, pageUrl, vin: VIN });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.record.indicators[0]?.openUrl).toBe(pageUrl);
  });
});

describe("pārlūka HTML foto: tikai zināmie izsoļu hosti", () => {
  function photosFor(id: "bidfax" | "stat_vin", html: string): string[] {
    const applied = applyBrowserArchiveHtml({
      record: record([]),
      id,
      html,
      pageUrl: id === "stat_vin" ? `https://stat.vin/cars/${VIN}` : `https://bidfax.info/?vin=${VIN}`,
      vin: VIN,
    });
    expect(applied.ok, id).toBe(true);
    if (!applied.ok) return [];
    const row = applied.record.indicators.find((r) => r.id === id);
    const fromAuctions = (row?.auctions ?? []).flatMap((a) => [a.photoUrl, ...(a.photoUrls ?? [])]);
    return [row?.media?.photoUrl, ...(row?.media?.photoUrls ?? []), ...fromAuctions].filter((u): u is string => Boolean(u));
  }

  it("izsoļu arhīvs: sveša hosta attēls ir izmests, atļautie paliek", () => {
    const html = `<div><h1>Audi ${VIN}</h1><p>Copart lot 555, damage: rear, 15 photos</p>
      <img src="https://tracker.evil.example/open.jpg?admin=1">
      <img src="http://bidfax.info/photos/http-only.jpg">
      <img data-src="https://10.0.0.5/internal.jpg">
      <img src="https://bidfax.info/photos/1.jpg">
      <img data-src="https://cs.copart.com/v1/auth/img/lot/555/2.jpg">
      <img src="https://d1abc.cloudfront.net/lots/555/3.jpg">
      <img src="https://vis.iaai.com/resizer?imageKeys=1~SID~B1~S0~I1&width=640"></div>`;
    const urls = photosFor("bidfax", html);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.some((u) => u.includes("evil.example"))).toBe(false);
    expect(urls.some((u) => u.startsWith("http://"))).toBe(false);
    expect(urls.some((u) => u.includes("10.0.0.5"))).toBe(false);
    expect(urls).toContain("https://bidfax.info/photos/1.jpg");
    expect(urls).toContain("https://cs.copart.com/v1/auth/img/lot/555/2.jpg");
    expect(urls).toContain("https://d1abc.cloudfront.net/lots/555/3.jpg");
    expect(urls.some((u) => u.includes("vis.iaai.com"))).toBe(true);
  });

  it("stat.vin: sveša hosta attēls ir izmests arī no parsera savāktajiem", () => {
    const html = STAT_HTML.replace(
      "</body>",
      `<img src="https://tracker.evil.example/auction/open.jpg"><a href="https://evil.example/x.png">x</a></body>`,
    );
    const urls = photosFor("stat_vin", html);
    expect(urls.some((u) => u.includes("evil.example"))).toBe(false);
    expect(urls).toContain("https://cs.copart.com/v1/auth/img/lot/50558298/1.jpg");
    expect(urls).toContain("https://cs.copart.com/v1/auth/img/lot/50558298/2.jpg");
  });
});
