import { describe, expect, it } from "vitest";

import { applyVinScanBrowserResultToSnapshot } from "@/lib/vin-scan/apply-browser-result";
import { VIN_SCAN_BROWSER_FETCH_IDS, browserFetchSummary } from "@/lib/vin-scan/browser-fetch";
import { VIN_SCAN_PAID_SOURCE_IDS } from "@/lib/vin-scan/free-sources";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

const VIN = "WBA5R1C0XLFH42873";

function awaiting(id: (typeof VIN_SCAN_BROWSER_FETCH_IDS)[number]): VinScanIndicator {
  return {
    id,
    label: id,
    country: "US",
    status: "browser_only",
    summary: browserFetchSummary(id),
    detail: "",
    openUrl: `https://example.test/${id}/${VIN}`,
  };
}

const STAT_HTML = `<!doctype html><html><body>
  <h1>RAM 2500 2026 VIN: ${VIN}</h1>
  <p>Sale History (13) Auction Date Final Bid Copart</p>
  <p>Lot: 50558298</p>
  <p>Location: Houston, TX</p>
  <p>Sale date: 2025-09-02</p>
  <p>Final bid: $5,200</p>
  <p>Odometer: 185389</p>
  <img src="https://cs.copart.com/v1/auth/img/lot/50558298/1.jpg">
</body></html>`;

describe("atsevišķā VIN SCAN pārlūka rezultāts", () => {
  it("stat.vin HTML pārraksta from-browser joslu un saglabā foto", () => {
    const applied = applyVinScanBrowserResultToSnapshot({
      snapshot: {
        vin: VIN,
        plates: emptyVinScanPlates(),
        scannedAt: "2026-10-17T10:00:00.000Z",
        indicators: [awaiting("stat_vin"), awaiting("nicb")],
      },
      vin: VIN,
      browserResult: {
        id: "stat_vin",
        status: "unknown",
        html: STAT_HTML,
        pageUrl: `https://stat.vin/cars/${VIN}`,
        httpStatus: 200,
      },
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.snapshot.scannedAt).toBe("2026-10-17T10:00:00.000Z");
    const stat = applied.snapshot.indicators.find((row) => row.id === "stat_vin");
    const nicb = applied.snapshot.indicators.find((row) => row.id === "nicb");
    expect(stat?.status).toBe("found");
    expect(stat?.media?.photoUrl).toContain("copart.com");
    expect(nicb?.status).toBe("browser_only");
  });

  it("maksas avotus nenolasa un status-only found saglabā kopsavilkumu", () => {
    for (const id of VIN_SCAN_PAID_SOURCE_IDS) {
      const paid = applyVinScanBrowserResultToSnapshot({
        snapshot: {
          vin: VIN,
          plates: emptyVinScanPlates(),
          scannedAt: "2026-10-17T10:00:00.000Z",
          indicators: [],
        },
        vin: VIN,
        browserResult: { id, status: "found", html: `<p>${VIN}</p>` },
      });
      expect(paid.ok).toBe(false);
      if (paid.ok) return;
      expect(paid.error).toBe("invalid_browser_result");
    }
    const statusOnly = applyVinScanBrowserResultToSnapshot({
      snapshot: {
        vin: VIN,
        plates: emptyVinScanPlates(),
        scannedAt: "2026-10-17T10:00:00.000Z",
        indicators: [awaiting("nicb")],
      },
      vin: VIN,
      browserResult: { id: "nicb", status: "none", summary: "Nav meklēšanā" },
    });
    expect(statusOnly.ok).toBe(true);
    if (!statusOnly.ok) return;
    expect(statusOnly.snapshot.indicators[0]?.status).toBe("none");
    expect(statusOnly.snapshot.indicators[0]?.summary).toBe("Nav meklēšanā");
  });

  it("cits VIN un tukšs unknown ir kļūda", () => {
    const mismatch = applyVinScanBrowserResultToSnapshot({
      snapshot: {
        vin: VIN,
        plates: emptyVinScanPlates(),
        scannedAt: "2026-10-17T10:00:00.000Z",
        indicators: [awaiting("stat_vin")],
      },
      vin: "WAUZZZF50NA041246",
      browserResult: { id: "stat_vin", status: "found", html: `<p>WAUZZZF50NA041246</p>` },
    });
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.error).toBe("vin_mismatch");
    const empty = applyVinScanBrowserResultToSnapshot({
      snapshot: {
        vin: VIN,
        plates: emptyVinScanPlates(),
        scannedAt: "2026-10-17T10:00:00.000Z",
        indicators: [awaiting("stat_vin")],
      },
      vin: VIN,
      browserResult: { id: "stat_vin", status: "unknown" },
    });
    expect(empty.ok).toBe(false);
  });

  it("maksas avota (CarVertical) rezultātu caur pārlūka importu nepieņem", () => {
    for (const id of [...VIN_SCAN_PAID_SOURCE_IDS, "carvertical_preview"]) {
      const applied = applyVinScanBrowserResultToSnapshot({
        snapshot: {
          vin: VIN,
          plates: emptyVinScanPlates(),
          scannedAt: "2026-10-17T10:00:00.000Z",
          indicators: [awaiting("stat_vin")],
        },
        vin: VIN,
        browserResult: { id, status: "found", summary: "CarVertical atskaite nopirkta", html: `<p>${VIN}</p>` },
      });
      expect(applied.ok, id).toBe(false);
    }
  });

  /* Maršruts /api/admin/vin-scan ar browserResult (saglabāšana, žurnāls, sacensība ar skenēšanu) ir
     pārbaudīts ar īstu maršrutu lib/vin-scan/vin-scan-route-import-race.test.ts; krātuves kļūda, kad
     Blob nav pieejams - lib/vin-scan/store-write.test.ts; marķieris, ko lasa Tampermonkey -
     lib/vin-scan/userscript-sync.test.ts un components/admin/AdminOrderVinScanCard.test.tsx. */
});

describe("atsevišķā rīka pageUrl pārbaude", () => {
  const catalog = `https://stat.vin/cars/${VIN}`;
  const cases: [string, string][] = [
    ["javascript:", "javascript:alert(1)"],
    ["http:", `http://stat.vin/cars/${VIN}`],
    ["svešs saimnieks", `https://evil.example/cars/${VIN}`],
    ["apakšdomēns", `https://en.stat.vin/cars/${VIN}`],
  ];
  for (const [name, pageUrl] of cases) {
    it(`${name}: saglabātā openUrl ir droša`, () => {
      const applied = applyVinScanBrowserResultToSnapshot({
        snapshot: null,
        vin: VIN,
        browserResult: { id: "stat_vin", html: STAT_HTML, pageUrl, httpStatus: 200 },
        now: "2026-11-17T10:00:00.000Z",
      });
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      const row = applied.snapshot.indicators.find((r) => r.id === "stat_vin");
      expect(row?.openUrl).toBe(name === "apakšdomēns" ? pageUrl : catalog);
    });
  }
});
