import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyVinScanBrowserResultToSnapshot } from "@/lib/vin-scan/apply-browser-result";
import { VIN_SCAN_BROWSER_FETCH_IDS, browserFetchSummary } from "@/lib/vin-scan/browser-fetch";
import { VIN_SCAN_PAID_SOURCE_IDS } from "@/lib/vin-scan/free-sources";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

const ROOT = process.cwd();
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

  it("atsevišķais rīks un API saglabā pārlūka rezultātu tajā pašā Blob ceļā", () => {
    const panel = readFileSync(path.join(ROOT, "components/admin/AdminVinScanPanel.tsx"), "utf8");
    const route = readFileSync(path.join(ROOT, "app/api/admin/vin-scan/route.ts"), "utf8");
    const handoff = readFileSync(path.join(ROOT, "components/admin/AdminVinScanBrowserFetchHandoff.tsx"), "utf8");
    const card = readFileSync(path.join(ROOT, "components/admin/AdminOrderVinScanCard.tsx"), "utf8");
    expect(panel).toContain("AdminVinScanBrowserFetchHandoff");
    expect(panel).toContain("provin-vin-scan-result");
    expect(panel).toContain("browserResult");
    expect(panel).toContain("/api/admin/vin-scan");
    expect(panel).not.toContain("purchaseCarVerticalReport");
    expect(handoff).toContain("data-provin-browser-fetch");
    expect(handoff).toContain("data-provin-stat-vin-fetch");
    expect(card).toContain("AdminVinScanBrowserFetchHandoff");
    expect(route).toContain("applyVinScanBrowserResultToSnapshot");
    expect(route).toContain("browserResult");
    expect(route).toContain("writeVinScanSnapshot");
    expect(route).toContain("preferBrowserArchiveImport");
    expect(route).not.toMatch(/purchaseCarVerticalReport|carvertical/i);
  });
});
