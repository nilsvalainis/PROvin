/**
 * Transportlīdzekļa „pirkstu nospiedums” — salīdzina vēsturiskās PROVIN audita atskaites.
 */
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export type VehicleReportFingerprint = {
  makeModel: string;
  makeTokens: string[];
  modelTokens: string[];
  year: number | null;
  engineCode: string;
  transmission: string;
  fuelType: string;
  engineDisplacementCm3: string;
  enginePowerKw: string;
  emissionStandard: string;
  typeCode: string;
};

const STOP_TOKENS = new Set([
  "BENZ",
  "BMW",
  "AUDI",
  "VW",
  "VOLKSWAGEN",
  "MERCEDES",
  "CLASS",
  "SERIES",
  "LIMOUSINE",
  "KOMBI",
  "AVANT",
  "TOURING",
  "SPORT",
  "LINE",
  "PAKET",
  "PACKAGE",
]);

function normToken(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function tokenizeMakeModel(raw: string): { makeTokens: string[]; modelTokens: string[] } {
  const parts = raw
    .toUpperCase()
    .split(/[\s,/]+/)
    .map(normToken)
    .filter((t) => t.length >= 2);
  const makeTokens: string[] = [];
  const modelTokens: string[] = [];
  for (const t of parts) {
    if (STOP_TOKENS.has(t)) {
      makeTokens.push(t);
      continue;
    }
    if (/^\d{3}[A-Z]{0,2}$/.test(t) || /^[A-Z]{1,2}\d{2,3}$/.test(t) || /^\d$/.test(t)) {
      modelTokens.push(t);
    } else if (t.length <= 4 && /^[A-Z]+$/.test(t)) {
      makeTokens.push(t);
    } else {
      modelTokens.push(t);
    }
  }
  return {
    makeTokens: [...new Set(makeTokens)],
    modelTokens: [...new Set(modelTokens)],
  };
}

function parseYearFromRegistration(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return Number.parseInt(iso[1]!, 10);
  const lv = t.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (lv) return Number.parseInt(lv[3]!, 10);
  const y = t.match(/\b(19|20)\d{2}\b/);
  if (y) return Number.parseInt(y[0], 10);
  return null;
}

function parseYearFromVin(vin: string | null | undefined): number | null {
  const v = (vin ?? "").trim().toUpperCase();
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

function normTransmission(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  if (/automat|automatic|auto\.|dsg|tiptronic|steptronic|s-tronic|7g|9g|8hp|zf8/.test(t)) return "auto";
  if (/manual|mehāni|mechan|schalt|getriebe.*manu/.test(t)) return "manual";
  return normToken(raw);
}

export function extractVehicleReportFingerprint(
  sourceBlocks: WorkspaceSourceBlocks,
  opts?: { vin?: string | null; manufactureYear?: number | null },
): VehicleReportFingerprint {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const csdd = blocks.csdd;
  const outvin = getAutoRecordsOutvinBundle(blocks.auto_records, opts?.vin ?? "");
  const vi = blocks.auto_records.outvinReport?.vehicleInfo ?? outvin.vehicleInfo;
  const { makeTokens, modelTokens } = tokenizeMakeModel(csdd.makeModel || vi.model || vi.series);
  const year =
    parseYearFromRegistration(csdd.firstRegistration) ??
    (opts?.manufactureYear != null && Number.isFinite(opts.manufactureYear) ? opts.manufactureYear : null) ??
    parseYearFromVin(opts?.vin);

  return {
    makeModel: (csdd.makeModel || vi.model || vi.series).trim(),
    makeTokens,
    modelTokens,
    year,
    engineCode: (vi.engineCode || "").trim().toUpperCase(),
    transmission: normTransmission(vi.transmission),
    fuelType: csdd.fuelType.trim().toLowerCase(),
    engineDisplacementCm3: csdd.engineDisplacementCm3.replace(/\D/g, ""),
    enginePowerKw: csdd.enginePowerKw.replace(/[^\d.,]/g, "").replace(",", "."),
    emissionStandard: csdd.emissionStandard.trim().toUpperCase(),
    typeCode: (vi.typeCode || "").trim().toUpperCase(),
  };
}

function tokenOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const t of a) if (setB.has(t)) hits += 1;
  return Math.min(20, hits * 8);
}

export function scoreVehicleFingerprintSimilarity(
  current: VehicleReportFingerprint,
  candidate: VehicleReportFingerprint,
): number {
  let score = 0;
  if (current.engineCode && candidate.engineCode && current.engineCode === candidate.engineCode) score += 40;
  if (current.transmission && candidate.transmission && current.transmission === candidate.transmission) score += 25;
  if (current.typeCode && candidate.typeCode && current.typeCode === candidate.typeCode) score += 15;
  score += tokenOverlapScore(current.makeTokens, candidate.makeTokens);
  score += tokenOverlapScore(current.modelTokens, candidate.modelTokens);
  if (current.year != null && candidate.year != null) {
    const diff = Math.abs(current.year - candidate.year);
    if (diff <= 2) score += 15;
    else if (diff <= 5) score += 8;
  }
  if (current.fuelType && candidate.fuelType && current.fuelType === candidate.fuelType) score += 10;
  if (current.emissionStandard && candidate.emissionStandard && current.emissionStandard === candidate.emissionStandard) {
    score += 5;
  }
  const d1 = Number.parseInt(current.engineDisplacementCm3, 10);
  const d2 = Number.parseInt(candidate.engineDisplacementCm3, 10);
  if (Number.isFinite(d1) && Number.isFinite(d2) && Math.abs(d1 - d2) <= 100) score += 8;
  return score;
}

export function formatVehicleFingerprintLabel(fp: VehicleReportFingerprint): string {
  const parts: string[] = [];
  if (fp.makeModel) parts.push(fp.makeModel);
  else if (fp.makeTokens.length || fp.modelTokens.length) {
    parts.push([...fp.makeTokens, ...fp.modelTokens].slice(0, 4).join(" "));
  }
  if (fp.year != null) parts.push(String(fp.year));
  if (fp.engineCode) parts.push(`dzinējs ${fp.engineCode}`);
  if (fp.transmission === "auto") parts.push("automātiskā ātrumkārba");
  else if (fp.transmission === "manual") parts.push("mehāniskā ātrumkārba");
  return parts.filter(Boolean).join(", ") || "līdzīgs segments";
}
