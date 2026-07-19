/**
 * Plan A — stingra lokālā (bez AI) AutoDNA / CarVertical / LTAB PDF parsēšana.
 */
import type { LtabIncidentRow, SourcePdfChecklist } from "@/lib/admin-source-blocks";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import { parseAutodnaDamageEvents } from "@/lib/autodna-damage-parse";
import { parseAutodnaMileagePaste } from "@/lib/autodna-mileage-paste-parse";
import {
  autoRecordsMileageRowHasData,
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import { parseCarverticalOdometerPaste } from "@/lib/carvertical-odometer-paste-parse";
import { parseCarverticalPdfText } from "@/lib/carvertical-pdf-parse";
import { extractClaimRowsForPdfInsight, type ClaimTableRow } from "@/lib/claim-rows-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import type { PdfIngestEngine } from "@/lib/pdf-ingest-types";
import { sanitizePdfTextForParsing } from "@/lib/pdf-text-sanitize-for-parse";
import {
  buildHybridSourcePdfComments,
  extractBodyDamageSnippets,
  formatIncidentFact,
  mileageTimelineFacts,
} from "@/lib/source-summary-comment-format";
import type { HistoryVendorPdfParseResult, HistoryVendorPdfTarget } from "@/lib/history-vendor-pdf-import";

const MAX_RAW = 120_000;

export type VendorStructureMatch = {
  matched: boolean;
  markers: string[];
};

function claimRowsToLtabRows(claims: ClaimTableRow[]): LtabIncidentRow[] {
  return claims.map((c) => ({
    csngDate: c.date.trim(),
    lossAmount: c.amount.trim(),
    incidentNo: normalizeCountryNameLv(c.iso) || c.iso,
  }));
}

function suggestChecklist(
  mileage: AutoRecordsServiceRow[],
  incidents: LtabIncidentRow[],
  text: string,
): Partial<SourcePdfChecklist> {
  const patch: Partial<SourcePdfChecklist> = {};
  if (mileage.length > 0) {
    patch.mileageHistory = true;
    patch.mileageLine = true;
  }
  if (incidents.length > 0) patch.incidents = true;
  if (/boj[āa]j|damage|accident|negad/i.test(text) && incidents.length === 0) {
    patch.incidents = true;
  }
  return patch;
}

/** Vai PDF tekstā ir atpazīstama avota struktūra (pirms Gemini). */
export function detectVendorPdfStructure(target: HistoryVendorPdfTarget, text: string): VendorStructureMatch {
  const t = text.slice(0, 200_000);
  const markers: string[] = [];

  if (target === "autodna") {
    if (/TRANSPORTLĪDZEKĻA\s+VĒSTURE/i.test(t)) markers.push("transportlidzekla_vesture");
    if (/Transportlīdzekļa\s+zaudējumu\s+apjoms|Zaudējumu\s+apjoms/i.test(t)) markers.push("zaudējumu_apjoms");
    if (/Pirm[āa]s\s+re[gģ]istr[aā]cijas\s+datums/i.test(t)) markers.push("pirmas_registracijas");
    if (/autodna|auto\s*dna/i.test(t)) markers.push("autodna_brand");
    if (/Odometra\s+rād[īi]jums/i.test(t)) markers.push("odometrs");
    return { matched: markers.length >= 1, markers };
  }

  if (target === "carvertical") {
    if (/VIN\s+numurs\s*:/i.test(t)) markers.push("vin_numurs");
    if (/Transportlīdzeklim\s+atrasto\s+bojājumu\s+skaits\s*:/i.test(t)) markers.push("bojajumu_skaits");
    if (/Odometra\s+rād[īi]jumu\s+ieraksti/i.test(t)) markers.push("odometra_zurnals");
    if (/carvertical/i.test(t)) markers.push("carvertical_brand");
    return { matched: markers.length >= 1, markers };
  }

  if (target === "ltab") {
    if (/Negadījumu\s+skaits\s*:/i.test(t)) markers.push("negadijumu_skaits");
    if (/LTAB|OCTA|Apdrošin[aā]šanas\s+polise/i.test(t)) markers.push("ltab_octa");
    if (/Re[gģ]istr[aā]cijas\s+numurs/i.test(t)) markers.push("reg_nr");
    return { matched: markers.length >= 1, markers };
  }

  return { matched: false, markers };
}

function extractAutodnaFirstRegistration(text: string): string | undefined {
  const m = text.match(
    /Pirm[āa]s\s+re[gģ]istr[aā]cijas\s+datums\s*[:\s]*(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})/i,
  );
  if (!m?.[1]) return undefined;
  return `Pirmās reģistrācijas datums: ${formatAutoRecordsDateForOutput(m[1])}`;
}

function extractCarverticalVin(text: string): string | undefined {
  const m = text.match(/VIN\s+numurs\s*:\s*([A-HJ-NPR-Z0-9]{17})/i);
  return m?.[1] ? `VIN: ${m[1].toUpperCase()}` : undefined;
}

function extractCarverticalDamageCount(text: string): string | undefined {
  const m = text.match(/Transportlīdzeklim\s+atrasto\s+bojājumu\s+skaits\s*:\s*(\d+)/i);
  if (m?.[1] == null) return undefined;
  return `Atrasto bojājumu skaits: ${m[1]}`;
}

/** Papildu CarVertical odometra regex visā tekstā (MM.YYYY … km). */
function extractCarverticalOdometerRegex(text: string): AutoRecordsServiceRow[] {
  const out: AutoRecordsServiceRow[] = [];
  const seen = new Set<string>();
  const re = /(\d{1,2})\.(\d{4})\.?\s*[-–—]?\s*([\d\s\u00a0]+)\s*km\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const mo = Number.parseInt(m[1] ?? "", 10);
    const y = Number.parseInt(m[2] ?? "", 10);
    const km = normalizeAutoRecordsOdometer(m[3] ?? "");
    if (mo < 1 || mo > 12 || y < 1980 || !km) continue;
    const date = `01.${String(mo).padStart(2, "0")}.${y}`;
    const key = `${date}|${km}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date: formatAutoRecordsDateForOutput(date), odometer: km, country: "" });
  }
  return sortAutoRecordsDescending(out);
}

function extractLtabMetaComments(text: string): string[] {
  const parts: string[] = [];
  const count = text.match(/Negadījumu\s+skaits\s*:\s*(\d+)/i);
  if (count?.[1] != null) parts.push(`Negadījumu skaits: ${count[1]}`);
  const reg = text.match(/Re[gģ]istr[aā]cijas\s+numurs\s*:\s*([^\n\r]+)/i);
  if (reg?.[1]) parts.push(`Reģ. nr.: ${reg[1].trim()}`);
  const pol = text.match(/Apdrošin[aā]šanas\s+polise\s*:\s*([^\n\r]+)/i);
  if (pol?.[1]) parts.push(`Polise: ${pol[1].trim()}`);
  return parts;
}

function extractAutodnaStatusCenterNote(text: string): string | undefined {
  if (!/Status\s+Center|status\s*center|brīdinājum/i.test(text)) return undefined;
  const alert = text.match(/(?:Status\s+Center[^\n]{0,160})/i);
  return alert?.[0]?.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function vendorLocalParseHasData(r: HistoryVendorPdfParseResult): boolean {
  if (r.serviceHistory.some(autoRecordsRowHasData)) return true;
  if (r.incidents.some(ltabRowHasData)) return true;
  if ((r.vehicleHistoryTimeline ?? []).some((row) => row.date.trim() || row.description.trim())) return true;
  if ((r.damageDetails ?? []).some((row) => row.date.trim() || row.lossAmount.trim())) return true;
  return false;
}

/**
 * Plan A — pilna lokālā parsēšana konkrētam avotam.
 */
export function parseVendorPdfLocal(
  target: HistoryVendorPdfTarget,
  text: string,
  opts?: { textBackend?: "pdf-parse" | "pdfjs" | "none" },
): HistoryVendorPdfParseResult {
  const trimmed = sanitizePdfTextForParsing(text).trim();
  const charCount = trimmed.length;
  const rawText = trimmed.slice(0, MAX_RAW);
  const warnings: string[] = [];
  const factualMeta: string[] = [];

  let serviceHistory: AutoRecordsServiceRow[] = [];
  let vehicleHistoryTimeline: HistoryVendorPdfParseResult["vehicleHistoryTimeline"];
  let damageDetails: HistoryVendorPdfParseResult["damageDetails"];
  let carverticalIncidents: LtabIncidentRow[] = [];

  if (target === "carvertical") {
    const parsed = parseCarverticalPdfText(trimmed);
    serviceHistory = parsed.serviceHistory;
    vehicleHistoryTimeline = parsed.timeline;
    damageDetails = parsed.damageDetails;
    carverticalIncidents = parsed.incidents;
    if (serviceHistory.length === 0) {
      serviceHistory = extractCarverticalOdometerRegex(trimmed);
    }
    const vin = extractCarverticalVin(trimmed);
    const dmg = extractCarverticalDamageCount(trimmed);
    if (vin) factualMeta.push(vin);
    if (dmg) factualMeta.push(dmg);
    if (parsed.timeline.length > 0) {
      factualMeta.push(`${parsed.timeline.length} vēstures ieraksti (laikposms)`);
    }
    if (parsed.damageDetails.length > 0) {
      factualMeta.push(`${parsed.damageDetails.length} bojājumu ieraksti`);
    }
  } else if (target === "autodna") {
    serviceHistory = parseAutodnaMileagePaste(trimmed);
    const reg = extractAutodnaFirstRegistration(trimmed);
    if (reg) factualMeta.push(reg);
    const statusNote = extractAutodnaStatusCenterNote(trimmed);
    if (statusNote) factualMeta.push(statusNote);
  }

  serviceHistory = sortAutoRecordsDescending(serviceHistory.filter(autoRecordsMileageRowHasData));

  const claims = extractClaimRowsForPdfInsight(trimmed, 1);
  const autodnaDamage = target === "autodna" ? parseAutodnaDamageEvents(trimmed) : [];
  let incidents =
    target === "carvertical" && carverticalIncidents.length > 0
      ? carverticalIncidents
      : autodnaDamage.length > 0
        ? autodnaDamage
        : claimRowsToLtabRows(claims);

  if (target === "ltab") {
    incidents = dedupeLtab(incidents);
    factualMeta.push(...extractLtabMetaComments(trimmed));
    if (incidents.length === 0) {
      warnings.push("LTAB: negadījumu rindas netika strukturētas — teksts saglabāts RAW.");
    }
  }

  const engine: PdfIngestEngine = "local_parser";

  const facts: string[] = [
    ...factualMeta,
    ...extractBodyDamageSnippets(trimmed, 2),
    ...mileageTimelineFacts(serviceHistory, 2),
  ];

  for (const row of incidents.filter(ltabRowHasData).slice(0, 2)) {
    const line = formatIncidentFact(row);
    if (line) facts.push(line);
  }

  const anomalies: string[] = [];

  if (target !== "ltab" && incidents.length === 0 && /boj[āa]j|damage|accident|atlīdz|negad/i.test(trimmed)) {
    if (extractBodyDamageSnippets(trimmed, 1).length === 0) {
      anomalies.push("Tekstā minēti bojājumi/negadījumi — strukturētās rindas trūkst");
    }
  }

  const negCount = trimmed.match(/Negadījumu\s+skaits\s*:\s*(\d+)/i);
  if (target === "ltab" && negCount?.[1] && Number.parseInt(negCount[1], 10) > 0 && incidents.length === 0) {
    anomalies.push(`Negadījumu skaits ${negCount[1]}, bet rindas netika strukturētas`);
  }

  const suggestedComments = buildHybridSourcePdfComments({ facts, anomalies });

  return {
    rawText,
    serviceHistory,
    incidents,
    ...(vehicleHistoryTimeline?.length ? { vehicleHistoryTimeline } : {}),
    ...(damageDetails?.length ? { damageDetails } : {}),
    suggestedPdfChecklist: suggestChecklist(serviceHistory, incidents, trimmed),
    suggestedComments,
    warnings: warnings.length ? warnings : [],
    meta: {
      charCount,
      mileageRowCount: serviceHistory.length,
      incidentRowCount: incidents.filter(ltabRowHasData).length,
      engine,
      textBackend: opts?.textBackend,
    },
  };
}

function dedupeLtab(rows: LtabIncidentRow[]): LtabIncidentRow[] {
  const seen = new Set<string>();
  const out: LtabIncidentRow[] = [];
  for (const r of rows) {
    if (!ltabRowHasData(r)) continue;
    const key = `${r.csngDate}|${r.lossAmount}|${r.incidentNo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}
