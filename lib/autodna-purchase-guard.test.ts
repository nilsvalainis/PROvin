import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  autodnaPrecheckCountsLabel,
  autodnaPurchaseGuardFromData,
  autodnaPurchaseGuardFromIndicator,
  autodnaPurchaseGuardFromPage,
  autodnaPurchaseGuardFromRelay,
  pickFreshestAutodnaGuard,
} from "@/lib/autodna-purchase-guard";
import { formatAutodnaPrecheckDetail, parseAutodnaPrecheckHtml, type AutodnaPrecheck } from "@/lib/vin-scan/autodna-precheck";
import { decidePrecheck, parsePrecheckHtml } from "@/relay/provin-autodna/lib/dna-precheck.mjs";

const fx = (name: string) => readFileSync(join(process.cwd(), "lib/vin-scan/__fixtures__", name), "utf8");
const READY = fx("autodna-precheck-ready.html");
const PENDING = fx("autodna-precheck-pending.html");

/** READY paraugā: vēsture 5, arhīva foto 0. Maina abu sadaļu rindas (null - sadaļas nosaukums nav atpazīstams). */
const HISTORY_ROW = `class="row-active tooltip-trigger">
 <div class="td-4"><span
 class="icon-ok"></span>
 </div>
 <div class="information-container">
 <div class="td-1">Transportlīdzekļa vēsture</div>
 <div class="td-3">
 Pieejams. 5 ieraksti </div>`;
const PHOTOS_ROW = `class="row-inactive tooltip-trigger">
 <div class="td-4"><span
 class="icon-disabled"></span>
 </div>
 <div class="information-container">
 <div class="td-1">Auto arhīva fotogrāfijas </div>
 <div class="td-3">
 Nav pieejams. 0 ieraksti </div>`;

function rowHtml(name: string, n: number | null): string {
  const label = n == null ? `Cita sadaļa ${name.length}` : name;
  const active = n != null && n > 0;
  return `class="${active ? "row-active" : "row-inactive"} tooltip-trigger">
 <div class="td-4"><span class="icon"></span>
 </div>
 <div class="information-container">
 <div class="td-1">${label}</div>
 <div class="td-3">
 ${active ? `Pieejams. ${n} ieraksti` : "Nav pieejams. 0 ieraksti"} </div>`;
}

function withCounts(history: number | null, photos: number | null): string {
  if (!READY.includes(HISTORY_ROW) || !READY.includes(PHOTOS_ROW)) throw new Error("paraugs mainījies");
  return READY.replace(HISTORY_ROW, rowHtml("Transportlīdzekļa vēsture", history)).replace(PHOTOS_ROW, rowHtml("Auto arhīva fotogrāfijas", photos));
}

describe("AutoDNA pirkuma aizsargs (Nila likums 25.11)", () => {
  it("relejs un PROVIN parsē priekšpārbaudi vienādi (tie paši paraugi)", () => {
    for (const html of [READY, PENDING, withCounts(0, 3), withCounts(0, 0), withCounts(null, null), "<html><body>Kaut kas cits</body></html>", ""]) {
      expect(parsePrecheckHtml(html)).toEqual(parseAutodnaPrecheckHtml(html));
      const ts = autodnaPurchaseGuardFromPage(parseAutodnaPrecheckHtml(html));
      const mjs = decidePrecheck(parsePrecheckHtml(html));
      expect({ allowed: mjs.allowed, code: mjs.code, photos: mjs.photos, history: mjs.history }).toEqual({
        allowed: ts.allowed,
        code: ts.code,
        photos: ts.photos,
        history: ts.history,
      });
    }
  });

  it("vēsture > 0 -> drīkst (dzīvs paraugs: vēsture 5, foto 0)", () => {
    expect(decidePrecheck(parsePrecheckHtml(READY))).toEqual({ allowed: true, photos: 0, history: 5 });
  });

  it("arhīva foto > 0 -> drīkst", () => {
    expect(decidePrecheck(parsePrecheckHtml(withCounts(0, 3)))).toEqual({ allowed: true, photos: 3, history: 0 });
  });

  it("abi 0 -> bloķē precheck_no_records", () => {
    expect(decidePrecheck(parsePrecheckHtml(withCounts(0, 0)))).toEqual({ allowed: false, code: "precheck_no_records", photos: 0, history: 0 });
  });

  it("Turnstile «Meklē pieejamo informāciju» -> bloķē precheck_unavailable", () => {
    expect(decidePrecheck(parsePrecheckHtml(PENDING))).toMatchObject({ allowed: false, code: "precheck_unavailable" });
  });

  it("nezināms formāts / tukša lapa / sadaļu nav -> bloķē precheck_unavailable", () => {
    expect(decidePrecheck(parsePrecheckHtml("<html><body>Kaut kas cits</body></html>"))).toMatchObject({ allowed: false, code: "precheck_unavailable" });
    expect(decidePrecheck(parsePrecheckHtml(""))).toMatchObject({ allowed: false, code: "precheck_unavailable" });
    expect(decidePrecheck(parsePrecheckHtml(withCounts(null, null)))).toMatchObject({ allowed: false, code: "precheck_unavailable" });
    expect(decidePrecheck(null)).toMatchObject({ allowed: false, code: "precheck_unavailable" });
  });

  it("VIN SCAN rinda: svaiga -> lēmums; veca / pending / bez detail -> null (jāielasa svaigi)", () => {
    const data: AutodnaPrecheck = {
      total: 3,
      vehicle: "",
      sections: [
        { name: "Transportlīdzekļa vēsture", available: false, count: 0 },
        { name: "Auto arhīva fotogrāfijas", available: true, count: 3 },
      ],
    };
    const detail = formatAutodnaPrecheckDetail(data);
    const now = Date.parse("2026-11-25T12:00:00Z");
    expect(autodnaPurchaseGuardFromIndicator({ status: "found", detail, scannedAt: "2026-11-25T08:00:00Z" }, { nowMs: now })).toMatchObject({
      allowed: true,
      photos: 3,
      history: 0,
      source: "vin_scan",
    });
    expect(autodnaPurchaseGuardFromIndicator({ status: "found", detail, scannedAt: "2026-11-23T08:00:00Z" }, { nowMs: now })).toBeNull();
    expect(autodnaPurchaseGuardFromIndicator({ status: "unknown", detail: "", scannedAt: "2026-11-25T08:00:00Z" }, { nowMs: now })).toBeNull();
    expect(autodnaPurchaseGuardFromIndicator({ status: "found", detail: "", scannedAt: "2026-11-25T08:00:00Z" }, { nowMs: now })).toBeNull();
    const zero = formatAutodnaPrecheckDetail({ ...data, sections: data.sections.map((s) => ({ ...s, available: false, count: 0 })) });
    expect(autodnaPurchaseGuardFromIndicator({ status: "none", detail: zero }, { fallbackAt: "2026-11-25T09:00:00Z", nowMs: now })).toMatchObject({
      allowed: false,
      code: "precheck_no_records",
    });
  });

  it("releja atbilde: allowed bez >0 skaitļa netiek ticēts; jebkas neskaidrs = nepērk", () => {
    expect(autodnaPurchaseGuardFromRelay({ allowed: true, photos: 2, history: 0 })).toMatchObject({ allowed: true });
    expect(autodnaPurchaseGuardFromRelay({ allowed: true, photos: 0, history: 0 })).toMatchObject({ allowed: false });
    expect(autodnaPurchaseGuardFromRelay({ allowed: false, code: "precheck_no_records", photos: 0, history: 0 })).toMatchObject({
      allowed: false,
      code: "precheck_no_records",
    });
    expect(autodnaPurchaseGuardFromRelay({ allowed: true })).toMatchObject({ allowed: false, code: "precheck_unavailable" });
    expect(autodnaPurchaseGuardFromRelay(null)).toMatchObject({ allowed: false, code: "precheck_unavailable" });
  });

  it("dati: tikai viena sadaļa zināma un 0 -> bloķē; teksts adminam", () => {
    expect(autodnaPurchaseGuardFromData({ total: 0, vehicle: "", sections: [{ name: "Auto arhīva fotogrāfijas", available: false, count: 0 }] })).toMatchObject({
      allowed: false,
      code: "precheck_no_records",
      history: null,
    });
    expect(autodnaPrecheckCountsLabel({ photos: 4, history: null })).toBe("Arhīva foto: 4 · Vēstures ieraksti: ?");
  });

  it("jaunākais VIN SCAN rezultāts uzvar", () => {
    const a = { allowed: false, photos: 0, history: 0, checkedAt: "2026-11-25T08:00:00Z" };
    const b = { allowed: true, photos: 1, history: 0, checkedAt: "2026-11-25T10:00:00Z" };
    expect(pickFreshestAutodnaGuard([a, null, b])).toBe(b);
    expect(pickFreshestAutodnaGuard([])).toBeNull();
  });
});
