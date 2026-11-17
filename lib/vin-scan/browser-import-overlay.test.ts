import { describe, expect, it } from "vitest";

import {
  browserImportWinsOverRow,
  overlayVinScanBrowserImports,
  type VinScanBrowserImport,
} from "@/lib/vin-scan/browser-import-overlay";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

const VIN = "WBA5R1C0XLFH42873";
const SNAP_AT = "2026-11-10T10:00:00.000Z";
const NOW = Date.parse("2026-11-10T10:05:00.000Z");

function row(id: VinScanIndicator["id"], status: VinScanIndicator["status"], scannedAt?: string, summary = ""): VinScanIndicator {
  return { id, label: id, country: "US", status, summary, detail: "", openUrl: null, ...(scannedAt ? { scannedAt } : {}) };
}

function imp(id: VinScanIndicator["id"], status: VinScanIndicator["status"], importedAt: string, summary = "no pārlūka"): VinScanBrowserImport {
  return { vin: VIN, id, importedAt, row: row(id, status, importedAt, summary) };
}

describe("browserImportWinsOverRow", () => {
  it("found/none imports uzvar servera browser_only un unknown rindu", () => {
    const i = imp("stat_vin", "found", "2026-11-10T10:01:00.000Z");
    expect(browserImportWinsOverRow(row("stat_vin", "browser_only", "2026-11-10T10:02:00.000Z"), SNAP_AT, i, NOW)).toBe(true);
    expect(browserImportWinsOverRow(row("stat_vin", "unknown", "2026-11-10T10:02:00.000Z"), SNAP_AT, i, NOW)).toBe(true);
    expect(browserImportWinsOverRow(undefined, SNAP_AT, imp("stat_vin", "none", "2026-11-10T10:01:00.000Z"), NOW)).toBe(true);
  });

  it("pret found/none rindu uzvar tikai jaunāks imports", () => {
    const serverRow = row("carinfo", "found", "2026-11-10T10:02:00.000Z");
    expect(browserImportWinsOverRow(serverRow, SNAP_AT, imp("carinfo", "none", "2026-11-10T10:01:00.000Z"), NOW)).toBe(false);
    expect(browserImportWinsOverRow(serverRow, SNAP_AT, imp("carinfo", "none", "2026-11-10T10:03:00.000Z"), NOW)).toBe(true);
  });

  it("rindas vecums bez sava scannedAt ir momentuzņēmuma scannedAt", () => {
    const bare = row("bidfax", "none");
    expect(browserImportWinsOverRow(bare, SNAP_AT, imp("bidfax", "found", "2026-11-10T09:59:00.000Z"), NOW)).toBe(false);
    expect(browserImportWinsOverRow(bare, SNAP_AT, imp("bidfax", "found", "2026-11-10T10:00:01.000Z"), NOW)).toBe(true);
  });

  it("imports ārpus avota TTL vai bez rezultāta neuzvar", () => {
    const browserOnly = row("stat_vin", "browser_only", "2026-11-10T10:02:00.000Z");
    // izsoļu arhīvs: found 30 dienas, none 3 dienas
    expect(browserImportWinsOverRow(browserOnly, SNAP_AT, imp("stat_vin", "found", "2026-10-01T10:00:00.000Z"), NOW)).toBe(false);
    expect(browserImportWinsOverRow(browserOnly, SNAP_AT, imp("stat_vin", "found", "2026-10-20T10:00:00.000Z"), NOW)).toBe(true);
    expect(browserImportWinsOverRow(browserOnly, SNAP_AT, imp("stat_vin", "none", "2026-11-06T10:00:00.000Z"), NOW)).toBe(false);
    expect(browserImportWinsOverRow(browserOnly, SNAP_AT, imp("stat_vin", "unknown", "2026-11-10T10:03:00.000Z"), NOW)).toBe(false);
    expect(browserImportWinsOverRow(browserOnly, SNAP_AT, imp("stat_vin", "found", "nav datums"), NOW)).toBe(false);
  });
});

describe("overlayVinScanBrowserImports", () => {
  it("aizstāj tikai importētās rindas, pārējās un secību patur, laiku ņem no importa", () => {
    const rows = [
      row("vin_decode", "found", SNAP_AT),
      row("stat_vin", "browser_only", SNAP_AT),
      row("csdd", "found", SNAP_AT, "CSDD dati"),
      row("bid_cars", "browser_only", SNAP_AT),
    ];
    const out = overlayVinScanBrowserImports(
      rows,
      SNAP_AT,
      [imp("stat_vin", "found", "2026-11-10T10:01:00.000Z", "3 izsoles"), imp("bid_cars", "none", "2026-11-10T10:02:00.000Z")],
      NOW,
    );
    expect(out.map((r) => [r.id, r.status])).toEqual([
      ["vin_decode", "found"],
      ["stat_vin", "found"],
      ["csdd", "found"],
      ["bid_cars", "none"],
    ]);
    expect(out[1]?.summary).toBe("3 izsoles");
    expect(out[1]?.scannedAt).toBe("2026-11-10T10:01:00.000Z");
    expect(out[2]).toBe(rows[2]);
    expect(rows[1]?.status).toBe("browser_only");
  });

  it("trūkstošu rindu pieliek beigās, novecojušu importu izlaiž", () => {
    const out = overlayVinScanBrowserImports(
      [row("vin_decode", "found", SNAP_AT)],
      SNAP_AT,
      [imp("poctra", "found", "2026-11-10T10:01:00.000Z"), imp("bidfax", "none", "2026-11-01T10:00:00.000Z")],
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(["vin_decode", "poctra"]);
  });

  it("no diviem viena avota importiem ņem jaunāko", () => {
    const out = overlayVinScanBrowserImports(
      [row("stat_vin", "browser_only", SNAP_AT)],
      SNAP_AT,
      [imp("stat_vin", "none", "2026-11-10T10:01:00.000Z"), imp("stat_vin", "found", "2026-11-10T10:03:00.000Z", "jaunākais")],
      NOW,
    );
    expect(out[0]?.status).toBe("found");
    expect(out[0]?.summary).toBe("jaunākais");
  });
});
