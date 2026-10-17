/**
 * Deterministiska agregātu identifikācija pirms tehnisko risku analīzes.
 * A = VIN / dīleris / Outvin / CSDD tieši; B = izsecināts; C = vairāki kandidāti.
 */
import { extractVehicleReportFingerprint } from "@/lib/admin-vehicle-report-fingerprint";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import {
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type {
  IdentificationConfidence,
  IdentifiedAggregateField,
  TechnicalRiskIdentification,
} from "@/lib/admin-ai-technical-risk-map-types";

export type EngineIdentificationInput = {
  sourceBlocks: WorkspaceSourceBlocks;
  vin?: string | null;
  manufactureYear?: number | null;
};

export type EngineAmbiguityRule = {
  id: string;
  label: string;
  match: (ctx: EngineIdContext) => boolean;
  resolve: (ctx: EngineIdContext) => Partial<TechnicalRiskIdentification> | null;
};

export type EngineIdContext = {
  makeModel: string;
  year: number | null;
  powerKw: number | null;
  displacementCm3: number | null;
  fuel: string;
  engineCodeDirect: string;
  developmentCode: string;
  transmissionDirect: string;
  driveDirect: string;
  vin: string;
  vinYear: number | null;
};

function emptyField(confidence: IdentificationConfidence = "C"): IdentifiedAggregateField {
  return { value: "", confidence, evidence: "", candidates: [] };
}

function field(
  value: string,
  confidence: IdentificationConfidence,
  evidence: string,
  candidates: string[] = [],
): IdentifiedAggregateField {
  return { value, confidence, evidence, candidates };
}

function parseYearFromVin(vin: string): number | null {
  const v = vin.trim().toUpperCase();
  if (v.length !== 17) return null;
  const c = v[9];
  if (!c) return null;
  const map: Record<string, number> = {
    A: 2010,
    B: 2011,
    C: 2012,
    D: 2013,
    E: 2014,
    F: 2015,
    G: 2016,
    H: 2017,
    J: 2018,
    K: 2019,
    L: 2020,
    M: 2021,
    N: 2022,
    P: 2023,
    R: 2024,
    S: 2025,
    T: 2026,
  };
  return map[c] ?? null;
}

function near(actual: number | null, expected: number, tol: number): boolean {
  return actual != null && Math.abs(actual - expected) <= tol;
}

function hay(ctx: EngineIdContext): string {
  return `${ctx.makeModel} ${ctx.developmentCode} ${ctx.fuel}`.toUpperCase();
}

function isBmwX1Xdrive20d135(ctx: EngineIdContext): boolean {
  const t = hay(ctx);
  if (!/\bBMW\b/.test(t) || !/\bX1\b/.test(t)) return false;
  if (!near(ctx.powerKw, 135, 3)) return false;
  if (ctx.displacementCm3 != null && !near(ctx.displacementCm3, 1995, 40)) return false;
  return /DĪZEL|DIESEL|XDRIVE20D|20D/.test(t) || /dīzel|diesel/.test(ctx.fuel);
}

function bmwX1Chassis(ctx: EngineIdContext): "E84" | "F48" | null {
  const t = hay(ctx);
  if (/\bE84\b/.test(t)) return "E84";
  if (/\bF48\b/.test(t)) return "F48";
  const year = ctx.year ?? ctx.vinYear;
  if (year != null && year <= 2014) return "E84";
  if (year != null && year >= 2016) return "F48";
  return null;
}

function resolveBmwX1Xdrive20d135(ctx: EngineIdContext): Partial<TechnicalRiskIdentification> | null {
  const chassis = bmwX1Chassis(ctx);
  const year = ctx.year ?? ctx.vinYear;
  if (chassis === "E84" || (chassis == null && year != null && year < 2015)) {
    return {
      engine: field("N47D20", ctx.engineCodeDirect ? "A" : "B", "BMW X1 xDrive20d 135 kW E84 līdz 2015", [
        "N47D20",
      ]),
      platform: field("E84", ctx.developmentCode ? "A" : "B", "X1 E84 pēc gada / šasijas", ["E84"]),
    };
  }
  if (chassis === "F48" || (chassis == null && year != null && year > 2015)) {
    return {
      engine: field("B47D20", ctx.engineCodeDirect ? "A" : "B", "BMW X1 xDrive20d 135 kW F48 no 2015", [
        "B47D20",
      ]),
      platform: field("F48", ctx.developmentCode ? "A" : "B", "X1 F48 pēc gada / šasijas", ["F48"]),
    };
  }
  return {
    engine: field("", "C", "2015 X1 xDrive20d 135 kW: E84 = N47D20, F48 = B47D20 - jalasa sasiju / VIN", [
      "N47D20",
      "B47D20",
    ]),
    platform: field("", "C", "2015 parejas gads starp E84 un F48", ["E84", "F48"]),
  };
}

/** Zināmās neskaidrības - paplašināma tabula. */
export const ENGINE_AMBIGUITY_RULES: EngineAmbiguityRule[] = [
  {
    id: "bmw-x1-xdrive20d-135kw",
    label: "BMW X1 xDrive20d 135 kW: E84 ≤2015 = N47D20, F48 2015+ = B47D20",
    match: isBmwX1Xdrive20d135,
    resolve: resolveBmwX1Xdrive20d135,
  },
];

export function buildEngineIdContext(input: EngineIdentificationInput): EngineIdContext {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const vin = (input.vin ?? "").trim().toUpperCase();
  const fp = extractVehicleReportFingerprint(blocks, {
    vin,
    manufactureYear: input.manufactureYear,
  });
  const vi = blocks.auto_records.outvinReport?.vehicleInfo;
  const bundleVi = getAutoRecordsOutvinBundle(blocks.auto_records, vin).vehicleInfo;
  const powerKw = Number.parseFloat(fp.enginePowerKw);
  const cm3 = Number.parseInt(fp.engineDisplacementCm3, 10);
  return {
    makeModel: fp.makeModel,
    year: fp.year,
    powerKw: Number.isFinite(powerKw) ? powerKw : null,
    displacementCm3: Number.isFinite(cm3) ? cm3 : null,
    fuel: fp.fuelType,
    engineCodeDirect: (fp.engineCode || vi?.engineCode || bundleVi.engineCode || "").trim().toUpperCase(),
    developmentCode: (vi?.developmentCode || bundleVi.developmentCode || "").trim().toUpperCase(),
    transmissionDirect: (vi?.transmission || bundleVi.transmission || "").trim(),
    driveDirect: (vi?.drive || bundleVi.drive || "").trim(),
    vin,
    vinYear: parseYearFromVin(vin),
  };
}

function applyRuleOverlay(
  base: TechnicalRiskIdentification,
  overlay: Partial<TechnicalRiskIdentification>,
): TechnicalRiskIdentification {
  return {
    engine: overlay.engine ?? base.engine,
    gearbox: overlay.gearbox ?? base.gearbox,
    platform: overlay.platform ?? base.platform,
    drive: overlay.drive ?? base.drive,
  };
}

export function identifyEngineGearboxPlatform(input: EngineIdentificationInput): TechnicalRiskIdentification {
  const ctx = buildEngineIdContext(input);

  const engine = ctx.engineCodeDirect
    ? field(ctx.engineCodeDirect, "A", "VIN dekoders / dīleris / Outvin / CSDD tieši")
    : emptyField("C");

  let gearbox = emptyField("C");
  if (ctx.transmissionDirect) {
    gearbox = field(ctx.transmissionDirect, "A", "Dīleris / Outvin kārbas lauks");
  }

  let platform = emptyField("C");
  if (ctx.developmentCode) {
    platform = field(ctx.developmentCode, "A", "Dīleris / Outvin izstrādes kods");
  }

  const drive = ctx.driveDirect
    ? field(ctx.driveDirect, "A", "Dīleris / Outvin piedziņa")
    : emptyField("C");

  let identified: TechnicalRiskIdentification = { engine, gearbox, platform, drive };

  if (!ctx.engineCodeDirect || !ctx.developmentCode) {
    for (const rule of ENGINE_AMBIGUITY_RULES) {
      if (!rule.match(ctx)) continue;
      const resolved = rule.resolve(ctx);
      if (!resolved) continue;
      identified = applyRuleOverlay(identified, {
        engine: ctx.engineCodeDirect ? identified.engine : resolved.engine,
        platform: ctx.developmentCode ? identified.platform : resolved.platform,
        gearbox: resolved.gearbox,
        drive: resolved.drive,
      });
      break;
    }
  }

  if (!identified.engine.value && identified.engine.candidates.length === 0 && ctx.powerKw && ctx.displacementCm3) {
    identified = {
      ...identified,
      engine: field("", "C", "Izsecināts no markas + kW + cm³ + gada; precīzs kods nav avotos", []),
    };
  }

  return identified;
}

export function formatEngineIdentificationForPrompt(id: TechnicalRiskIdentification): string {
  const line = (label: string, f: IdentifiedAggregateField) => {
    const cand = f.candidates.length ? `; kandidāti: ${f.candidates.join(", ")}` : "";
    return `- ${label}: value=${f.value || "-"} confidence=${f.confidence} evidence=${f.evidence || "-"}${cand}`;
  };
  const conditional =
    id.engine.confidence === "C"
      ? "\nDzinēja kods nav viennozīmīgs (C). Riskus, kas atkarīgi no koda, formulē NOSACĪTI. Klātienē jānolasa marķējums uz bloka."
      : id.engine.confidence === "B"
        ? "\nDzinēja kods izsecināts (B). Iekļauj teikumu, ka kods noteikts pēc jaudas un tilpuma; to apstiprina marķējums uz bloka."
        : "";
  return `### Agregātu identifikācija (obligāta pirms risku kartes)
${line("Dzinējs", id.engine)}
${line("Kārba", id.gearbox)}
${line("Platforma", id.platform)}
${id.drive ? line("Piedziņa", id.drive) : ""}
${conditional}`;
}
