import { describe, expect, it } from "vitest";

import {
  adminPushVinScanCanaryMessage,
  appendVinScanCanaryRun,
  classifyVinScanCanaryStatus,
  decideVinScanCanaryAlert,
  emptyVinScanCanaryDoc,
  parseVinScanCanaryDoc,
  vinScanCanaryBroken,
  vinScanCanarySummaryLine,
  VIN_SCAN_CANARY_KEEP_RUNS,
  type VinScanCanaryResult,
  type VinScanCanaryRunRecord,
} from "@/lib/vin-scan/canary-alert";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-11-23T03:30:00Z");
const VIN = "WDD2120251A120979";

function r(state: VinScanCanaryResult["state"], status = state === "ok" ? "found" : state === "no_data" ? "none" : "timeout"): VinScanCanaryResult {
  return { vin: VIN, state, status };
}

function run(dayOffset: number, results: Record<string, VinScanCanaryResult>): VinScanCanaryRunRecord {
  return { at: new Date(T0 + dayOffset * DAY).toISOString(), results };
}

describe("statusa klasifikācija", () => {
  it("found = ok; none = nav datu tikai, ja zelta VIN gaida datus", () => {
    expect(classifyVinScanCanaryStatus("found", "found")).toBe("ok");
    expect(classifyVinScanCanaryStatus("found", "none")).toBe("no_data");
    expect(classifyVinScanCanaryStatus("any", "none")).toBe("ok");
  });

  it("noildze / unknown / trūkstoša rinda = kļūda; izslēgts / pārlūka josla / budžets = izlaists", () => {
    for (const s of ["timeout", "unknown", "blocked", "missing"]) expect(classifyVinScanCanaryStatus("any", s)).toBe("error");
    for (const s of ["skipped", "config_missing", "browser_only", "budget"]) expect(classifyVinScanCanaryStatus("found", s)).toBe("skipped");
  });
});

describe("sabrukuši avoti", () => {
  it("viena kļūda nav sabrukums; kļūda 2 dienas pēc kārtas ir", () => {
    const d1 = run(0, { mnt_ee: r("error"), tjekbil: r("ok") });
    expect(vinScanCanaryBroken(d1, [])).toEqual([]);
    const d2 = run(1, { mnt_ee: r("error"), tjekbil: r("ok") });
    expect(vinScanCanaryBroken(d2, [d1]).map((b) => `${b.id}:${b.reason}`)).toEqual(["mnt_ee:error_2x"]);
  });

  it("zelta VIN pēkšņi bez datiem - uzreiz", () => {
    const d1 = run(0, { tjekbil: r("ok") });
    const d2 = run(1, { tjekbil: r("no_data") });
    expect(vinScanCanaryBroken(d2, [d1]).map((b) => b.reason)).toEqual(["no_data_after_data"]);
  });

  it("izlaistās palaišanas neskaita; par vecu (>3 d) iepriekšējo neņem", () => {
    const d1 = run(0, { carinfo: r("error") });
    const d2 = run(1, { carinfo: { vin: VIN, state: "skipped", status: "budget" } });
    const d3 = run(2, { carinfo: r("error") });
    expect(vinScanCanaryBroken(d3, [d1, d2]).map((b) => b.id)).toEqual(["carinfo"]);
    const late = run(5, { carinfo: r("error") });
    expect(vinScanCanaryBroken(late, [d1])).toEqual([]);
  });

  it("reālo skenējumu sērijas pievieno (bez dublikāta)", () => {
    const d1 = run(0, { mnt_ee: r("error") });
    const d2 = run(1, { mnt_ee: r("error") });
    const out = vinScanCanaryBroken(d2, [d1], [
      { id: "mnt_ee", streak: 4 },
      { id: "lkf_ee", streak: 3 },
      { id: "nav_tads", streak: 9 },
    ]);
    expect(out.map((b) => b.key)).toEqual(["mnt_ee", "scan:lkf_ee"]);
  });
});

describe("paziņojums vienreiz", () => {
  it("jauns sabrukums → push; tas pats nākamajā dienā → nē; atguvies → atslēga pazūd", () => {
    const broken = [{ key: "mnt_ee", id: "mnt_ee", reason: "error_2x" as const }];
    const first = decideVinScanCanaryAlert(broken, {}, "2026-11-24T03:30:00.000Z");
    expect(first.send).toBe(true);
    expect(first.next).toEqual({ mnt_ee: "2026-11-24T03:30:00.000Z" });
    const again = decideVinScanCanaryAlert(broken, first.next, "2026-11-25T03:30:00.000Z");
    expect(again.send).toBe(false);
    expect(again.next).toEqual(first.next);
    expect(decideVinScanCanaryAlert([], again.next, "2026-11-26T03:30:00.000Z")).toEqual({ send: false, fresh: [], next: {} });
  });

  it("push teksts ar avota nosaukumu un iemeslu", () => {
    const msg = adminPushVinScanCanaryMessage([
      { key: "mnt_ee", id: "mnt_ee", reason: "error_2x" },
      { key: "tjekbil", id: "tjekbil", reason: "no_data_after_data" },
    ]);
    expect(msg.body).toBe("mnt.ee (kļūda 2 dienas), tjekbil.dk (zelta VIN pēkšņi bez datiem)");
    expect(msg.url).toBe("/admin/vin-scan");
  });
});

describe("vēsture un rīta rinda", () => {
  it("glabā pēdējās palaišanas", () => {
    let doc = emptyVinScanCanaryDoc();
    for (let i = 0; i < VIN_SCAN_CANARY_KEEP_RUNS + 3; i += 1) doc = appendVinScanCanaryRun(doc, run(i, {}));
    expect(doc.runs).toHaveLength(VIN_SCAN_CANARY_KEEP_RUNS);
    expect(parseVinScanCanaryDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(parseVinScanCanaryDoc(null)).toEqual(emptyVinScanCanaryDoc());
  });

  it("«VIN SCAN: N/M avoti strādā; sabrukuši: …»", () => {
    const doc = {
      ...emptyVinScanCanaryDoc(),
      runs: [
        run(0, {
          tjekbil: r("ok"),
          esyn: r("ok"),
          mnt_ee: r("error"),
          carinfo: r("no_data"),
          thecarapi_eu: { vin: VIN, state: "skipped" as const, status: "skipped" },
        }),
      ],
      alerted: { mnt_ee: "2026-11-23T03:30:00.000Z" },
    };
    expect(vinScanCanarySummaryLine(doc, T0 + 2 * 60 * 60 * 1000)).toBe(
      "VIN SCAN: 2/4 avoti strādā; sabrukuši: mnt.ee; šodien nestrādā: car.info",
    );
    expect(vinScanCanarySummaryLine(doc, T0 + 3 * DAY)).toBe("VIN SCAN: uzraudzība nav palaista kopš 2026-11-23");
    expect(vinScanCanarySummaryLine(emptyVinScanCanaryDoc(), T0)).toBeNull();
  });
});
