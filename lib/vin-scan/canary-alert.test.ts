import { describe, expect, it } from "vitest";

import {
  adminPushVinScanCanaryMessage,
  canaryStreakFailures,
  decideCanaryAlert,
  evaluateVinScanCanary,
  VIN_SCAN_CANARY_ALERT_REPEAT_MS,
  type VinScanCanaryRun,
} from "@/lib/vin-scan/canary-alert";

const IDS = ["vin_decode", "stat_vin"];
const NOW = Date.parse("2026-10-22T03:30:00Z");

const healthy: VinScanCanaryRun[] = [
  { vin: "WBA5R1C0XLFH42873", statVinRecord: true, statuses: { vin_decode: "found", stat_vin: "found" } },
  { vin: "YV1DZ5251B2146640", statVinRecord: false, statuses: { vin_decode: "found", stat_vin: "none" } },
];

describe("VIN SCAN kanārijputna novērtējums", () => {
  it("zaļš, ja dekodēšana atrod un stat.vin atrod zināmo ierakstu", () => {
    expect(evaluateVinScanCanary(healthy, IDS)).toEqual([]);
  });

  it("stat.vin browser_only serverī nav kļūme (dati nāk no pārlūka)", () => {
    const runs = healthy.map((r) => ({ ...r, statuses: { vin_decode: "found", stat_vin: "browser_only" } }));
    expect(evaluateVinScanCanary(runs, IDS)).toEqual([]);
  });

  it("krīt, ja stat.vin vairs neatrod zināmo ierakstu vai avots atgriež kļūdu", () => {
    const runs: VinScanCanaryRun[] = [
      { ...healthy[0]!, statuses: { vin_decode: "found", stat_vin: "none" } },
      { ...healthy[1]!, statuses: { vin_decode: "found", stat_vin: "timeout" } },
    ];
    expect(evaluateVinScanCanary(runs, IDS).map((f) => `${f.sourceId}:${f.status}`)).toEqual([
      "stat_vin:none",
      "stat_vin:timeout",
    ]);
  });

  it("trūkstošs avots vai izmesta kļūda ir kļūme", () => {
    const runs: VinScanCanaryRun[] = [
      { ...healthy[0]!, statuses: { stat_vin: "found" } },
      { ...healthy[1]!, statuses: {}, error: "boom" },
    ];
    expect(evaluateVinScanCanary(runs, IDS).map((f) => f.sourceId)).toEqual(["vin_decode", "scan"]);
  });
});

describe("push dedupe", () => {
  const fail = [{ vin: "WBA5R1C0XLFH42873", sourceId: "stat_vin", status: "none" }];

  it("pirmā kļūme sūta push, tā pati kļūme 3 dienās vairs nesūta", () => {
    const first = decideCanaryAlert(fail, {}, NOW);
    expect(first.send).toBe(true);
    const again = decideCanaryAlert(fail, first.next, NOW + 24 * 3600_000);
    expect(again).toMatchObject({ send: false, reason: "already_sent" });
    const later = decideCanaryAlert(fail, first.next, NOW + VIN_SCAN_CANARY_ALERT_REPEAT_MS + 1);
    expect(later.send).toBe(true);
  });

  it("cits avots krīt - jauns push uzreiz", () => {
    const first = decideCanaryAlert(fail, {}, NOW);
    const other = decideCanaryAlert([{ vin: "x", sourceId: "vin_decode", status: "error" }], first.next, NOW + 3600_000);
    expect(other.send).toBe(true);
  });

  it("pēc atveseļošanās stāvoklis notīrīts, nākamā kļūme paziņo uzreiz", () => {
    const first = decideCanaryAlert(fail, {}, NOW);
    const ok = decideCanaryAlert([], first.next, NOW + 3600_000);
    expect(ok).toEqual({ send: false, reason: "ok", next: {} });
    expect(decideCanaryAlert(fail, ok.next, NOW + 7200_000).send).toBe(true);
  });

  it("push teksts bez VIN, ar avotu nosaukumiem, saite uz /admin", () => {
    const m = adminPushVinScanCanaryMessage([...fail, { vin: "y", sourceId: "stat_vin", status: "timeout" }]);
    expect(m.body).toBe("Krīt: stat.vin (2 pārbaudes)");
    expect(m.url.startsWith("/admin")).toBe(true);
    expect(m.audience).toBe("pro");
    expect(m.body).not.toContain("WBA5R1C0XLFH42873");
  });
});

describe("VIN SCAN kanārijputns: DK atvērtie API un kļūdu sērijas", () => {
  const ids = ["vin_decode", "stat_vin", "tjekbil", "esyn"];
  const dk = (tjekbil: string, esyn: string): VinScanCanaryRun => ({
    vin: "WVWZZZ7NZEV015204",
    statVinRecord: false,
    expectFound: ["tjekbil", "esyn"],
    statuses: { vin_decode: "found", stat_vin: "browser_only", tjekbil, esyn },
  });

  it("DK VIN atrasts abos - zaļš", () => {
    expect(evaluateVinScanCanary([dk("found", "found")], ids)).toEqual([]);
  });

  it("DK VIN pēkšņi none (API formāts mainījies) ir kļūme", () => {
    expect(evaluateVinScanCanary([dk("none", "found")], ids).map((f) => `${f.sourceId}:${f.status}`)).toEqual([
      "tjekbil:none",
    ]);
  });

  it("citam VIN tjekbil none nav kļūme", () => {
    const run: VinScanCanaryRun = {
      vin: "YV1DZ5251B2146640",
      statVinRecord: false,
      statuses: { vin_decode: "found", stat_vin: "none", tjekbil: "none", esyn: "none" },
    };
    expect(evaluateVinScanCanary([run], ids)).toEqual([]);
  });

  it("mnt.ee 3 kļūdas pēc kārtas reālos skenējumos ir kļūme un nonāk push tekstā", () => {
    const failures = canaryStreakFailures([
      { id: "mnt_ee", streak: 56 },
      { id: "not_a_vin_scan_source", streak: 9 },
    ]);
    expect(failures.map((f) => f.sourceId)).toEqual(["mnt_ee"]);
    const msg = adminPushVinScanCanaryMessage(failures);
    expect(msg.body).toMatch(/Igaunija|mnt/i);
    expect(decideCanaryAlert(failures, {}, NOW).send).toBe(true);
  });
});
