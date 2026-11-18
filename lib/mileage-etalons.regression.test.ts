import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mergeSourceBlocksWithDefaults, toPdfManualVendorBlocks, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";
import {
  applyOdometerAnomalyOverrides,
  classifyOdometerAnomalies,
  hasActiveRollbackAnomaly,
  type OdometerAnomalyOverride,
} from "@/lib/odometer-anomaly-classify";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  hasAnyOdometerAnomaly,
  prepareUnifiedMileageDisplayRows,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";

/**
 * Nobraukuma etalona kopa (Nils 17.11): 41 īsta lieta no pabeigtiem auditiem (ieejas dati no pasūtījumu melnrakstiem,
 * bez komentāriem, foto un personas datiem). Tests nofiksē, KO SISTĒMA DARA TAGAD - tabulas rindas, anomālijas,
 * klases, sarkano joslu un AI faktu lapas laukus. Tas nav apgalvojums, ka rezultāts ir pareizs: zināmās kļūdas ir
 * aprakstītas `lib/__fixtures__/mileage-etalons/README.md`. Mainot nobraukuma loģiku, snapshot atšķirības jāizskata pa vienai.
 */

const DIR = path.join(__dirname, "__fixtures__", "mileage-etalons");

type Fixture = {
  vin: string;
  label: string;
  listingUrl: string | null;
  odometerAnomalyOverrides: OdometerAnomalyOverride[] | null;
  sourceBlocks: WorkspaceSourceBlocks;
};

function payloadOf(blocks: WorkspaceSourceBlocks, listingUrl: string | null): UnifiedMileageSourcePayload {
  return {
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    oneautoBlock: blocks.oneauto,
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    citiAvotiBlock: blocks.citi_avoti,
    tirgusForm: blocks.tirgus,
    listingUrl,
  };
}

function snapshotOf(fx: Fixture) {
  const blocks = mergeSourceBlocksWithDefaults(fx.sourceBlocks);
  const collected = collectUnifiedMileageRows(payloadOf(blocks, fx.listingUrl));
  const display = prepareUnifiedMileageDisplayRows(collected);
  const analysis = analyzeUnifiedMileageAnomalies(display);
  const classified = classifyOdometerAnomalies(display);
  const byOrder = new Map(display.map((r) => [r.sourceOrder, r]));
  const point = (order: number) => {
    const r = byOrder.get(order);
    return r ? `${r.date} | ${r.odometer} | ${r.sourceLabels?.join(" + ") ?? r.sourceLabel}` : `?${order}`;
  };
  const facts = buildCanonicalFacts({ vin: fx.vin, listingUrl: fx.listingUrl, sourceBlocks: blocks });
  const perSource: Record<string, number> = {};
  for (const r of collected) perSource[r.sourceLabel] = (perSource[r.sourceLabel] ?? 0) + 1;
  return {
    label: fx.label,
    rindasPaAvotiem: perSource,
    rindasSavaktas: collected.length,
    rindasTabula: display.length,
    tabula: [...display]
      .sort((a, b) => a.sortableTime - b.sortableTime || a.sourceOrder - b.sourceOrder)
      .map((r) => {
        const marks = [
          analysis.anomalyBySourceOrder.get(r.sourceOrder) ? "ANOMĀLIJA" : "",
          analysis.chartExcludeSourceOrders.has(r.sourceOrder) ? "nav grafikā" : "",
          analysis.dataEntryErrorSourceOrders.has(r.sourceOrder) ? "ievades kļūda" : "",
          analysis.staleDocumentSourceOrders.has(r.sourceOrder) ? "novecojis dokuments" : "",
          analysis.listingBelowRecordedSourceOrders.has(r.sourceOrder) ? "sludinājumā mazāk" : "",
          r.datePrecision === "month" ? "mēnesis" : "",
          r.unit === "mi" ? "jūdzes" : "",
          r.countryInferred ? "secināta valsts" : "",
        ].filter(Boolean);
        return `${r.date} | ${r.odometer} | ${r.country} | ${r.sourceLabels?.join(" + ") ?? r.sourceLabel}${marks.length ? ` | ${marks.join(", ")}` : ""}`;
      }),
    sarkanaJosla: hasAnyOdometerAnomaly(analysis.anomalyBySourceOrder),
    klases: classified.map((a) => `${a.class}: ${a.fromDate} ${a.fromKm} -> ${a.toDate} ${a.toKm} (kritums ${a.dropKm}) [${point(a.sourceOrder)}]`),
    kritumsBezNilaLemumiem: hasActiveRollbackAnomaly(display),
    nilaLemumi: fx.odometerAnomalyOverrides ?? [],
    klasesPecNilaLemumiem: applyOdometerAnomalyOverrides(classified, fx.odometerAnomalyOverrides).map((a) => `${a.class}: ${a.toDate} ${a.toKm}`),
    faktuLapa: {
      odometerAnomaly: facts.odometerAnomaly,
      carverticalMileageWarning: facts.carverticalMileageWarning,
      maxRollbackDropKm: facts.maxRollbackDropKm,
      rollbacks: facts.rollbacks.map((b) => `${b.fromDate} ${b.fromKm} -> ${b.toDate} ${b.toKm}`),
      suspectedEntryErrors: facts.suspectedEntryErrors.map((e) => `${e.date} ${e.km} ${e.source}`),
      implausibleReadings: facts.implausibleReadings.map((r) => `${r.date} ${r.odometer} ${r.sourceLabel}`),
      latestKm: facts.latestKm,
    },
  };
}

describe("nobraukuma etalona kopa: pašreizējais rezultāts", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

  it("kopā ir 41 lieta", () => {
    expect(files.length).toBe(41);
  });

  for (const file of files) {
    it(file.replace(".json", ""), async () => {
      const fx = JSON.parse(readFileSync(path.join(DIR, file), "utf8")) as Fixture;
      const snap = snapshotOf(fx);
      expect(snap.rindasSavaktas).toBeGreaterThan(0);
      await expect(JSON.stringify(snap, null, 1) + "\n").toMatchFileSnapshot(
        path.join(DIR, "__snapshots__", file.replace(".json", ".snap.json")),
      );
    });
  }
});
