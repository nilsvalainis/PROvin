import { describe, expect, it } from "vitest";

import { emptyVinRegistryBlock } from "@/lib/admin-source-blocks";
import { buildTraficomData, buildTraficomRawText } from "@/relay/provin-traficom/lib/traficom-page.mjs";
import {
  applyTraficomFiResultToBlock,
  readTraficomFiRelayConfig,
  reduceTraficomFiProgress,
  reduceTraficomFiResult,
  sanitizeTraficomFiData,
  traficomFiAutoPrevAllowsStart,
  traficomFiAutoSignal,
  traficomFiCanApplyManually,
  traficomFiCanRestorePrevious,
  traficomFiClientShouldSync,
  traficomFiLastInspection,
  traficomFiScanRowView,
} from "@/lib/traficom-fi-auto-logic";
import type { TraficomFiAutoStatus, TraficomFiData } from "@/lib/traficom-fi-auto-types";

/** Izdomāti dati (nav īsts auto). */
const VIN = "WVGZZZE2ZXX000001";
const NOW = "2026-11-26T20:40:00.000Z";

const PAGE = {
  title: "Car Volkswagen, VW ID.4 GTX 220 KW",
  banners: ["The vehicle is under a prohibition of driving or use"],
  summary: [
    ["Vehicle identification number (VIN)", VIN],
    ["Vehicle status", "Decommissioned"],
    ["Next inspection period", "8.11.2021-10.11.2025"],
    ["Tax status", "No unpaid vehicle tax / No unpaid additional tax"],
  ],
  remarks: [
    { text: "Periodic inspection not performed/approved", tone: "red" },
    { text: "Vehicle decommissioning (Deregistrated due to a damage)", tone: "red" },
    { text: "Vehicle decommissioning (Reregistration abroad)", tone: "red" },
    { text: "Pending data", tone: "yellow" },
    { text: "There is a notification of transfer entry for the vehicle", tone: "yellow" },
  ],
  source: "SOURCE: TRANSPORT REGISTER 26.11.2026 22.38",
  sections: [
    { title: "Basic information", rows: [["Make", "Volkswagen"], ["First registration in Finland", "1.3.2021"]] },
    {
      title: "Inspection information",
      rows: [
        ["Inspection date", "2.3.2024"],
        ["Inspection result", "Rejected"],
        ["Odometer reading", "45 678 km"],
        ["Defects", "Brake disc corrosion"],
      ],
    },
  ],
};

function relayResult(): { data: TraficomFiData; rawText: string } {
  const data = buildTraficomData(PAGE) as TraficomFiData;
  return { data, rawText: buildTraficomRawText(data) };
}

describe("Traficom (FI) automātika: stāvokļi", () => {
  it("konfigurācija tikai ar https un tokenu", () => {
    expect(readTraficomFiRelayConfig({})).toBeNull();
    expect(readTraficomFiRelayConfig({ TRAFICOM_RELAY_URL: "http://x", TRAFICOM_RELAY_TOKEN: "a".repeat(32) })).toBeNull();
    expect(readTraficomFiRelayConfig({ TRAFICOM_RELAY_URL: "https://relay.example/traficom/", TRAFICOM_RELAY_TOKEN: "a".repeat(32), TRAFICOM_AUTO_ENABLED: "1" })).toEqual({
      baseUrl: "https://relay.example/traficom",
      token: "a".repeat(32),
      autoEnabled: true,
    });
  });

  it("gaida eParaksts (ar kodu) -> meklē -> kļūda latviski", () => {
    const ev = { jobId: "j1", ref: "order_abc123", vin: VIN };
    const a = reduceTraficomFiProgress(null, { ...ev, state: "awaiting_eparaksts", verificationCode: "4821" }, NOW);
    expect(a).toMatchObject({ state: "awaiting_eparaksts", verificationCode: "4821", message: "Gaida eParaksts apstiprinājumu telefonā" });
    const b = reduceTraficomFiProgress(a, { ...ev, state: "searching" }, NOW);
    expect(b.state).toBe("searching");
    expect(b.verificationCode).toBeUndefined();
    const c = reduceTraficomFiProgress(b, { ...ev, state: "error", code: "eparaksts_timeout" }, NOW);
    expect(c.message).toContain("5 min");
    expect(reduceTraficomFiProgress(b, { ...ev, state: "error", code: "paid" }, NOW).message).toContain("neko neapmaksā");
  });

  it("rezultāts: atrasts / nav atrasts / tukšs", () => {
    const { data, rawText } = relayResult();
    const found = reduceTraficomFiResult(null, { jobId: "j1", ref: "order_abc123", vin: VIN, state: "result", found: true, rawText, data }, NOW);
    expect(found.state).toBe("found");
    expect(found.data?.flags.length).toBe(6);
    expect(reduceTraficomFiResult(null, { jobId: "j1", ref: "r", vin: VIN, state: "result", found: false }, NOW).state).toBe("not_found");
    expect(reduceTraficomFiResult(null, { jobId: "j1", ref: "r", vin: VIN, state: "result", found: true }, NOW).state).toBe("error");
    expect(sanitizeTraficomFiData({ flags: "x" })).toBeUndefined();
  });

  it("automātika tikai ar FI pazīmēm, vienreiz uz atsauci", () => {
    expect(traficomFiAutoSignal([{ id: "carinfo", status: "found", summary: "Exported to Finland" }]).start).toBe(true);
    expect(traficomFiAutoSignal([{ id: "thecarapi_eu", status: "found", summary: "Auction: Kaup24 (FI)" }])).toEqual({ start: true, reason: "Izsole (TheCarApi)" });
    expect(traficomFiAutoSignal([{ id: "carfax_eu", status: "found", summary: "Registered in Finland" }]).reason).toBe("CARFAX");
    expect(traficomFiAutoSignal([], { fi: "ABC-123" }).start).toBe(true);
    expect(traficomFiAutoSignal([{ id: "carinfo", status: "found", summary: "Sweden" }]).start).toBe(false);
    // Traficom pati sevi nepalaiž.
    expect(traficomFiAutoSignal([{ id: "traficom", status: "found", summary: "Finland" }]).start).toBe(false);
    expect(traficomFiAutoPrevAllowsStart(null)).toBe(true);
    expect(traficomFiAutoPrevAllowsStart({ state: "found", updatedAt: NOW })).toBe(false);
    expect(traficomFiAutoPrevAllowsStart({ state: "skipped", updatedAt: NOW })).toBe(true);
  });
});

describe("Traficom (FI) -> traficom_fi bloks", () => {
  it("statuss, karogi «Uzmanību», apskate ar trūkumiem (TA kartīte), nobraukums, FI periods", () => {
    const { data, rawText } = relayResult();
    const before = { ...emptyVinRegistryBlock(), comments: "<p>Nila komentārs</p>", rawUnprocessedData: "vecais teksts" };
    const block = applyTraficomFiResultToBlock(before, { rawText, data });
    expect(block.rawUnprocessedData).toBe(rawText);
    expect(block.comments).toBe("<p>Nila komentārs</p>");
    expect(block.statusRecords).toContain("Statuss: noņemts no reģistra (Decommissioned).");
    expect(block.autoNotes).toContain("Uzmanību: Transportlīdzeklim noteikts braukšanas / lietošanas aizliegums.");
    expect(block.autoNotes).toContain("Uzmanību: Auto noņemts no reģistra bojājuma dēļ.");
    expect(block.autoNotes).toContain("Uzmanību: Auto noņemts no reģistra (reģistrēts ārzemēs).");
    expect(block.autoNotes).toContain("paziņojums par īpašuma maiņu");
    expect(block.mileage).toEqual([{ date: "02.03.2024", odometer: "45678", country: "Somija", origin: "Apskate" }]);
    const ta = block.timeline.find((r) => r.date === "02.03.2024");
    expect(ta?.event).toBe("Tehniskā apskate: Neizturēta · Trūkumi: Brake disc corrosion");
    expect(block.timeline.some((r) => r.event === "Pirmā reģistrācija Somijā")).toBe(true);
    // Atkārtota ievietošana neko nedublē.
    const again = applyTraficomFiResultToBlock(block, { rawText, data });
    expect(again.mileage).toHaveLength(1);
    expect(again.timeline.filter((r) => r.date === "02.03.2024")).toHaveLength(1);
    expect(again.autoNotes.split("\n").filter((l) => /bojājuma dēļ/.test(l))).toHaveLength(1);
  });

  it("pēdējā apskate tikai no bezmaksas «Inspection information»", () => {
    expect(traficomFiLastInspection(relayResult().data)).toMatchObject({ date: "02.03.2024", odometer: "45678", result: "Neizturēta" });
    expect(traficomFiLastInspection({ ...relayResult().data, sections: [] })).toBeNull();
  });

  it("pogas: ievietot / sinhronizēt / atjaunot iepriekšējo RAW (kā e.csdd #1277)", () => {
    const { data, rawText } = relayResult();
    const status: TraficomFiAutoStatus = { state: "found", updatedAt: NOW, checkedAt: NOW, rawText, data };
    const old = { ...emptyVinRegistryBlock(), rawUnprocessedData: "vecais teksts" };
    expect(traficomFiCanApplyManually(status, old)).toBe(true);
    const applied: TraficomFiAutoStatus = { ...status, appliedAt: NOW, appliedBy: "auto", previousRawText: "vecais teksts" };
    expect(traficomFiClientShouldSync(applied, old)).toBe(true);
    const now = applyTraficomFiResultToBlock(old, { rawText, data });
    expect(traficomFiCanApplyManually(applied, now)).toBe(false);
    expect(traficomFiCanRestorePrevious(applied, now)).toBe(true);
    expect(traficomFiClientShouldSync(applied, now)).toBe(false);
    expect(traficomFiCanRestorePrevious({ ...applied, previousRawText: "" }, now)).toBe(false);
  });

  it("VIN SCAN rinda «Traficom (FI)»", () => {
    const { data, rawText } = relayResult();
    expect(traficomFiScanRowView(null)).toBeNull();
    expect(traficomFiScanRowView({ state: "awaiting_eparaksts", updatedAt: NOW, verificationCode: "4821" })).toMatchObject({
      status: "checking",
      summary: "Traficom (FI): gaida eParaksts apstiprinājumu telefonā · kods 4821",
    });
    const found = traficomFiScanRowView({ state: "found", updatedAt: NOW, rawText, data });
    expect(found?.status).toBe("found");
    expect(found?.summary).toContain("sarkani karogi");
    expect(found?.detail).toContain("Uzmanību:");
    expect(traficomFiScanRowView({ state: "not_found", updatedAt: NOW })?.status).toBe("none");
  });
});
