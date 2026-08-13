/**
 * Kopīgie tipi un palīgi AutoDNA / CarVertical atskaišu deterministiskajai ekstrakcijai.
 *
 * Princips: katra PDF struktūra ir līdzīga, bet atšķirīga — tāpēc katram avotam ir savs
 * parseris, kas atgriež vienu un to pašu formu (nobraukums, negadījumi, valstu laikposms,
 * dīlera tehniskie lauki).
 */

import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import type { OutvinEquipmentLine, OutvinVehicleInfo } from "@/lib/outvin-dealer-types";
import type { CountryTimelineEntry } from "@/lib/vehicle-country-timeline";
import type { VendorServiceEntry } from "@/lib/vendor-service-history";

/** `dealer` — oficiālā dīlera / rūpnīcas izdruka (BMW portāls, auto-records.com). */
export type VendorReportVendor = "autodna" | "carvertical" | "dealer";

export type VendorReportExtract = {
  vendor: VendorReportVendor;
  /** Nobraukuma rindas: datums (DD.MM.YYYY), odometrs (cipari), valsts. */
  mileage: AutoRecordsServiceRow[];
  /** Negadījumi: datums, summa EUR, valsts (`incidentNo` = valsts kolonna). */
  incidents: LtabIncidentRow[];
  /** Apkopes / remonti ar veiktajiem darbiem (bez tehniskajām apskatēm). */
  serviceHistory: VendorServiceEntry[];
  /** Auto dzīves cikls pa valstīm (valsts noteikšanai tukšajām rindām). */
  countryTimeline: CountryTimelineEntry[];
  /** Dīlera tehniskie lauki (OFICIĀLĀ DĪLERA DATI). */
  vehicleInfo: Partial<OutvinVehicleInfo>;
  /** Rūpnīcas komplektācija (kods + apraksts) — tikai dīlera / rūpnīcas izdrukām. */
  equipment: OutvinEquipmentLine[];
  /** Gatavs teksts laukam „Servisa vēsture” (tikai fakti) — tikai dīlera izdrukām. */
  serviceHistoryNotes: string;
  /** Negadījumu / nozagto reģistru pārbaudes teksts, ja atskaitē ir šāda sadaļa. */
  accidentCheck: string;
  stolenCheck: string;
  /** Audita piezīmes: valūtas pārrēķini, izlaistās cenu rindas. */
  notes: string[];
};

export function emptyVendorReportExtract(vendor: VendorReportVendor): VendorReportExtract {
  return {
    vendor,
    mileage: [],
    incidents: [],
    serviceHistory: [],
    countryTimeline: [],
    vehicleInfo: {},
    equipment: [],
    serviceHistoryNotes: "",
    accidentCheck: "",
    stolenCheck: "",
    notes: [],
  };
}

/** Avota bloks, kurā nonāk šī atskaite (dīlera izdruka → OFICIĀLĀ DĪLERA DATI). */
export function vendorSourceKey(vendor: VendorReportVendor): CopilotSourceKey {
  return vendor === "dealer" ? "auto_records" : vendor;
}

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/g;

/** Pirmais derīgais VIN dokumentā (bez I/O/Q, ar vismaz vienu ciparu). */
export function findVinInText(text: string): string {
  const seen = new Map<string, number>();
  for (const m of text.matchAll(VIN_RE)) {
    const vin = (m[1] ?? "").toUpperCase();
    if (!/\d/.test(vin) || !/[A-Z]/.test(vin)) continue;
    seen.set(vin, (seen.get(vin) ?? 0) + 1);
  }
  if (seen.size === 0) return "";
  return [...seen.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

export type SpecCandidate = {
  /** Cilvēkam lasāms apzīmējums („Havana Black Metallic”). */
  value: string;
  /** Precīzais kods, ja pieejams („LY8X”). */
  code?: string;
  /** Satura precizitāte (piem. „Valcona leather” > „Leather package”); noklusējums 0. */
  priority?: number;
};

const SPEC_PLACEHOLDER_RE = /^(-+|—|–|n\/?a|nav\s+datu|nezināms)$/i;

function normalizeSpecValue(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/[;,]+$/, "").trim();
}

function composeSpec(candidate: SpecCandidate): string {
  const value = normalizeSpecValue(candidate.value);
  const code = normalizeSpecValue(candidate.code ?? "");
  if (!value) return code;
  if (!code || value.toUpperCase() === code.toUpperCase()) return value;
  if (value.toUpperCase().includes(code.toUpperCase())) return value;
  return `${value} (${code})`;
}

function specScore(candidate: SpecCandidate): number {
  const value = normalizeSpecValue(candidate.value);
  const code = normalizeSpecValue(candidate.code ?? "");
  const words = value ? value.split(/\s+/).length : 0;
  return (candidate.priority ?? 0) * 10_000 + (code ? 1000 : 0) + words * 25 + value.length;
}

/**
 * Izvēlas „sarežģītāko un garāko” apzīmējumu ar precīzu kodu, ja tāds ir
 * (krāsa / interjērs / transmisija — kā prasa OFICIĀLĀ DĪLERA DATI lauki).
 */
export function pickMostSpecificSpec(candidates: SpecCandidate[]): string {
  const usable = candidates
    .map((c) => ({
      candidate: c,
      value: normalizeSpecValue(c.value),
      code: normalizeSpecValue(c.code ?? ""),
    }))
    .filter((c) => (c.value || c.code) && !SPEC_PLACEHOLDER_RE.test(c.value));
  if (usable.length === 0) return "";
  let best = usable[0]!;
  for (const item of usable.slice(1)) {
    if (specScore(item.candidate) > specScore(best.candidate)) best = item;
  }
  return composeSpec(best.candidate);
}

/** Apvieno divu avotu tehniskos laukus: tukšos aizpilda, aizpildītos pārraksta tikai ar specifiskāku. */
export function mergeVehicleInfoPreferSpecific(
  base: Partial<OutvinVehicleInfo>,
  incoming: Partial<OutvinVehicleInfo>,
): Partial<OutvinVehicleInfo> {
  const out: Partial<OutvinVehicleInfo> = { ...base };
  for (const [key, rawValue] of Object.entries(incoming) as [keyof OutvinVehicleInfo, string][]) {
    const value = normalizeSpecValue(rawValue ?? "");
    if (!value || SPEC_PLACEHOLDER_RE.test(value)) continue;
    const current = normalizeSpecValue(out[key] ?? "");
    if (!current) {
      out[key] = value;
      continue;
    }
    if (key === "vinCode") continue;
    const better = pickMostSpecificSpec([{ value: current }, { value }]);
    out[key] = better || current;
  }
  return out;
}
