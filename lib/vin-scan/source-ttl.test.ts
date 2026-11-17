import { describe, expect, it } from "vitest";

import {
  pickReusableVinScanRows,
  stampVinScanRowById,
  stampVinScanRows,
  vinScanIndicatorsFresh,
  vinScanRowTtlMs,
} from "@/lib/vin-scan/source-ttl";
import { isVinScanBreakerRow, vinScanSourceHealthOutcomes } from "@/lib/vin-scan/source-health-outcomes";

const H = 60 * 60 * 1000;
const D = 24 * H;
const NOW = Date.parse("2026-11-17T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("vinScanRowTtlMs", () => {
  it("reģistri: found 7 d, none 3 d", () => {
    for (const id of ["csdd", "mnt_ee", "lkf_ee", "tjekbil", "esyn", "dsb", "carinfo", "rdw", "nummerplade", "carpass", "biluppgifter", "vegvesen"]) {
      expect(vinScanRowTtlMs(id, "found")).toBe(7 * D);
      expect(vinScanRowTtlMs(id, "none")).toBe(3 * D);
    }
  });

  it("izsoļu arhīvi: found 30 d, none 3 d", () => {
    for (const id of ["stat_vin", "bid_cars", "bidfax", "poctra", "checkcar_vin", "plc_auction", "carfax_eu", "auchistory"]) {
      expect(vinScanRowTtlMs(id, "found")).toBe(30 * D);
      expect(vinScanRowTtlMs(id, "none")).toBe(3 * D);
    }
  });

  it("atsaukumi 7 d, vin_decode 30 d, sludinājumi un pārējie 12 h", () => {
    for (const id of ["nhtsa_recalls", "recall_vw", "recall_bmw", "recall_mercedes", "recall_volvo", "recall_toyota"]) {
      expect(vinScanRowTtlMs(id, "found")).toBe(7 * D);
      expect(vinScanRowTtlMs(id, "none")).toBe(7 * D);
    }
    expect(vinScanRowTtlMs("vin_decode", "found")).toBe(30 * D);
    expect(vinScanRowTtlMs("listing_history", "found")).toBe(12 * H);
    expect(vinScanRowTtlMs("listing_history", "none")).toBe(12 * H);
    expect(vinScanRowTtlMs("nicb", "found")).toBe(12 * H);
    expect(vinScanRowTtlMs("joj_copart_iaai", "none")).toBe(12 * H);
  });

  it("nekešojami statusi: 0", () => {
    for (const status of ["unknown", "timeout", "blocked", "needs_input", "browser_only", "skipped", "manual", "config_missing"]) {
      expect(vinScanRowTtlMs("csdd", status)).toBe(0);
      expect(vinScanRowTtlMs("stat_vin", status)).toBe(0);
    }
  });
});

describe("pickReusableVinScanRows", () => {
  const snapAt = ago(13 * H);

  it("reģistra found pirms 3 d - ņem no keša; sludinājumi pirms 13 h - skenē; unknown - vienmēr skenē", () => {
    const prev = [
      { id: "csdd", status: "found", summary: "", scannedAt: ago(3 * D) },
      { id: "listing_history", status: "found", summary: "" },
      { id: "mnt_ee", status: "unknown", summary: "relejs", scannedAt: ago(1 * H) },
      { id: "stat_vin", status: "found", summary: "" },
    ];
    const ids = pickReusableVinScanRows(prev, snapAt, NOW, false).map((r) => r.id);
    expect(ids).toEqual(["csdd", "stat_vin"]);
  });

  it("atgrieztās rindas patur savu laiku vai saņem momentuzņēmuma laiku", () => {
    const prev = [
      { id: "csdd", status: "found", summary: "", scannedAt: ago(3 * D) },
      { id: "stat_vin", status: "found", summary: "" },
    ];
    const rows = pickReusableVinScanRows(prev, snapAt, NOW, false);
    expect(rows.map((r) => r.scannedAt)).toEqual([ago(3 * D), snapAt]);
  });

  it("reģistra none pirms 4 d - skenē vēlreiz", () => {
    const prev = [{ id: "tjekbil", status: "none", summary: "", scannedAt: ago(4 * D) }];
    expect(pickReusableVinScanRows(prev, snapAt, NOW, false)).toEqual([]);
  });

  it("force skenē visu", () => {
    const prev = [
      { id: "csdd", status: "found", summary: "", scannedAt: ago(1 * H) },
      { id: "vin_decode", status: "found", summary: "" },
    ];
    expect(pickReusableVinScanRows(prev, snapAt, NOW, true)).toEqual([]);
  });

  it("nederīgs laiks - skenē", () => {
    expect(pickReusableVinScanRows([{ id: "csdd", status: "found", summary: "" }], "nav-datums", NOW, false)).toEqual([]);
  });
});

describe("vinScanIndicatorsFresh", () => {
  const decode = { id: "vin_decode", status: "found", summary: "Volvo" };

  it("jaukti vecumi: viss savā TTL - svaigs", () => {
    const rows = [
      { ...decode, scannedAt: ago(20 * D) },
      { id: "csdd", status: "found", summary: "", scannedAt: ago(6 * D) },
      { id: "stat_vin", status: "found", summary: "", scannedAt: ago(25 * D) },
      { id: "tjekbil", status: "none", summary: "", scannedAt: ago(2 * D) },
      { id: "listing_history", status: "none", summary: "", scannedAt: ago(1 * H) },
      { id: "regitra", status: "browser_only", summary: "tikai pārlūkā" },
      { id: "csdd_dummy_needs", status: "needs_input", summary: "Vajag numuru" },
    ];
    expect(vinScanIndicatorsFresh(rows, ago(1 * H), NOW)).toBe(true);
  });

  it("viena rinda pāri TTL - nav svaigs", () => {
    const rows = [
      { ...decode, scannedAt: ago(1 * D) },
      { id: "csdd", status: "found", summary: "", scannedAt: ago(6 * D) },
      { id: "listing_history", status: "found", summary: "", scannedAt: ago(13 * H) },
    ];
    expect(vinScanIndicatorsFresh(rows, ago(1 * H), NOW)).toBe(false);
  });

  it("rinda bez laika lieto momentuzņēmuma scannedAt", () => {
    const rows = [decode, { id: "csdd", status: "found", summary: "" }];
    expect(vinScanIndicatorsFresh(rows, ago(5 * D), NOW)).toBe(true);
    expect(vinScanIndicatorsFresh(rows, ago(8 * D), NOW)).toBe(false);
  });

  it("unknown / timeout vai nav dekodējuma - nav svaigs", () => {
    expect(vinScanIndicatorsFresh([decode, { id: "mnt_ee", status: "unknown", summary: "x" }], ago(H), NOW)).toBe(false);
    expect(vinScanIndicatorsFresh([decode, { id: "mnt_ee", status: "timeout", summary: "" }], ago(H), NOW)).toBe(false);
    expect(vinScanIndicatorsFresh([{ id: "csdd", status: "found", summary: "" }], ago(H), NOW)).toBe(false);
    expect(vinScanIndicatorsFresh([], ago(H), NOW)).toBe(false);
    expect(vinScanIndicatorsFresh([{ ...decode, scannedAt: ago(31 * D) }], ago(H), NOW)).toBe(false);
  });
});

describe("rindu laika zīmogi", () => {
  it("stampVinScanRows patur esošo laiku, bet overwrite to pārraksta", () => {
    const rows = [
      { id: "csdd", status: "found", scannedAt: ago(D) },
      { id: "rdw", status: "none" },
    ];
    expect(stampVinScanRows(rows, ago(H)).map((r) => r.scannedAt)).toEqual([ago(D), ago(H)]);
    expect(stampVinScanRows(rows, ago(H), true).map((r) => r.scannedAt)).toEqual([ago(H), ago(H)]);
  });

  it("nederīgs rezerves laiks padara rindu novecojušu", () => {
    const [row] = stampVinScanRows([{ id: "csdd", status: "found" }], "x");
    expect(vinScanIndicatorsFresh([{ id: "vin_decode", status: "found", scannedAt: ago(H) }, row!], ago(H), NOW)).toBe(false);
  });

  it("stampVinScanRowById maina tikai importēto rindu", () => {
    const input: { id: string; status: string; scannedAt?: string }[] = [
      { id: "stat_vin", status: "found" },
      { id: "csdd", status: "found" },
    ];
    const rows = stampVinScanRowById(input, "stat_vin", ago(0));
    expect(rows[0]!.scannedAt).toBe(ago(0));
    expect(rows[1]!.scannedAt).toBeUndefined();
  });
});

describe("breaker marķieris", () => {
  it("flag vai kopsavilkuma prefikss - netiek ierakstīts veselībā", () => {
    expect(isVinScanBreakerRow({ breakerOpen: true, summary: "" })).toBe(true);
    expect(isVinScanBreakerRow({ summary: "Avots īslaicīgi atslēgts (7 kļūdas pēc kārtas), nākamā pārbaude pēc ~3 min" })).toBe(true);
    expect(
      vinScanSourceHealthOutcomes([
        { id: "mnt_ee", status: "unknown", summary: "mnt.ee relejs noildza", breakerOpen: true },
        { id: "lkf_ee", status: "unknown", summary: "lkf.ee HTTP ielase neizdevās (fetch failed)" },
      ]),
    ).toEqual([{ id: "lkf_ee", ok: false, msg: "lkf.ee HTTP ielase neizdevās (fetch failed)" }]);
  });
});
