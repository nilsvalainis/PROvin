/**
 * Traficom (Somijas Transport Register) PDF un ielīmēta teksta parseris.
 * Viens ceļš PDF augšupielādei un Copilot ielīmētam tekstam. Somijas reģistrs
 * nepublicē nobraukumu — šis avots pievieno tikai īpašnieku ķēdi, lietošanas
 * veidu un statusa/piezīmju faktus, nekad nobraukuma rindas.
 */
import {
  emptyVinRegistryBlock,
  sortVinRegistryTimeline,
  type VinRegistryBlockState,
  type VinRegistryIncidentRow,
  type VinRegistryTimelineRow,
} from "@/lib/admin-source-blocks";
import { ADMIN_MILEAGE_PASTE_RAW_MAX_LEN } from "@/lib/admin-raw-field-limits";
import { sanitizeVinRegistryClientLine } from "@/lib/vin-registry-client-text";

const FI = "Somija";

export type TraficomParsedReport = {
  plate: string;
  vin: string;
  ownersSummary: string;
  statusRecords: string;
  autoNotes: string;
  timeline: VinRegistryTimelineRow[];
  incidents: VinRegistryIncidentRow[];
  aiContextRaw: string;
};

const HEADER_JUNK =
  /^(Vehicle information|Source:\s*Transport Register|Finnish Transport and Communications Agency|PO Box 320, 00059 TRAFICOM.*)$/i;

function linesOf(text: string): string[] {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^Page \d+\s*\/\s*\d+$/i.test(line) &&
        !/^\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}$/.test(line) &&
        !HEADER_JUNK.test(line),
    );
}

export function looksLikeTraficomReport(text: string): boolean {
  return /traficom|transport register|finnish transport and communications agency/i.test(text);
}

/** Viena / divu rindu „Label / Value” — PDF izraksta ekstrakcijas artefakts. */
function findLabelValue(lines: string[], labelRe: RegExp): string {
  for (let i = 0; i < lines.length; i++) {
    const m = labelRe.exec(lines[i]!);
    if (!m) continue;
    const rest = lines[i]!.slice(m[0].length).trim();
    if (rest) return rest;
    return (lines[i + 1] ?? "").trim();
  }
  return "";
}

/** Visas rindas, kas sākas ar dotu virsrakstu, līdz nākamajam zināmajam virsrakstam. */
function sectionLines(lines: string[], startRe: RegExp, stopRe: RegExp): string[] {
  const startIdx = lines.findIndex((l) => startRe.test(l));
  if (startIdx === -1) return [];
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (stopRe.test(lines[i]!)) {
      endIdx = i;
      break;
    }
  }
  const startLine = lines[startIdx]!;
  const headed = startRe.exec(startLine);
  const rest = headed ? startLine.slice(headed[0].length).trim() : "";
  return [...(rest ? [rest] : []), ...lines.slice(startIdx + 1, endIdx)];
}

function dateFi(raw: string): string {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw.trim());
  if (!m) return raw.trim();
  return `${m[1]!.padStart(2, "0")}.${m[2]!.padStart(2, "0")}.${m[3]}`;
}

const OWNERSHIP_TYPE_RE =
  /(First owner|Second owner|Third owner|Fourth owner|Fifth owner|First operator|Second operator|Third operator|Other operator)/;

function ownershipTypeLv(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "first owner") return "Pirmais īpašnieks";
  if (t === "second owner") return "Otrais īpašnieks";
  if (t === "third owner") return "Trešais īpašnieks";
  if (t === "fourth owner") return "Ceturtais īpašnieks";
  if (t === "fifth owner") return "Piektais īpašnieks";
  if (t === "first operator") return "Pirmais operators (lietotājs)";
  if (t === "second operator") return "Otrais operators (lietotājs)";
  if (t === "third operator") return "Trešais operators (lietotājs)";
  if (t === "other operator") return "Cits operators (lietotājs)";
  return "Īpašnieks";
}

function isOwnerRole(typeRaw: string): boolean {
  return /owner/i.test(typeRaw);
}

type OwnerHistoryRow = { start: string; end: string; name: string; typeRaw: string };

/** „Owner history” tabula — periods (var būt vairākas rindas nosaukumam) + tips. */
function parseOwnerHistory(lines: string[]): OwnerHistoryRow[] {
  const body = sectionLines(
    lines,
    /^Owner history\b/i,
    /^(Engine details|Inspection information|Safety equipment|This information is subject to a fee\.?)/i,
  )
    .filter((l) => !/^(Period|Name|Ownership Type)$/i.test(l))
    .join(" ");
  const rows: OwnerHistoryRow[] = [];
  const rowRe = new RegExp(
    "(\\d{1,2}\\.\\d{1,2}\\.\\d{4})\\s*[\u2013-]\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{4})?\\s+([\\s\\S]{1,200}?)\\s+" +
      OWNERSHIP_TYPE_RE.source,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(body))) {
    rows.push({
      start: m[1] ?? "",
      end: m[2] ?? "",
      name: (m[3] ?? "").trim().replace(/,\s*$/, ""),
      typeRaw: m[4] ?? "",
    });
  }
  return rows;
}

/** „Owner(s)” (spēkā esošie) — datums + nosaukums. */
function parseCurrentOwner(lines: string[]): { start: string; name: string } | null {
  const body = sectionLines(
    lines,
    /^Owner\(s\)$/i,
    /^(Owner history|Engine details|This information is subject to a fee\.?)/i,
  )
    .filter((l) => !/^Starting from$/i.test(l) && !/^Owner\(s\)$/i.test(l))
    .join(" ");
  const m = /(\d{1,2}\.\d{1,2}\.\d{4})\s+([\s\S]{2,160}?)(?=$|\s{2,})/.exec(body.trim());
  if (!m) return null;
  return { start: m[1] ?? "", name: (m[2] ?? "").trim() };
}

const USE_LV: Record<string, string> = {
  private: "Privāta lietošana",
  "sales storage": "Pārdošanā (izplatītāja glabāšana)",
  taxi: "TAXI",
  rental: "Īre",
  "driving school": "Autoskola",
  company: "Uzņēmuma lietošanā",
};

function useLv(raw: string): string {
  return USE_LV[raw.trim().toLowerCase()] ?? raw.trim();
}

type UseHistoryRow = { use: string; start: string };

function parseUseHistory(lines: string[]): UseHistoryRow[] {
  const body = sectionLines(
    lines,
    /^Use history\b/i,
    /^(Decommissioning history|This information is subject to a fee\.?)/i,
  ).filter((l) => !/^(Use|Start date)$/i.test(l));
  const rows: UseHistoryRow[] = [];
  const rowRe = /([A-Za-z][A-Za-z\s]{1,40}?)\s+(\d{1,2}\.\d{1,2}\.\d{4})/g;
  const joined = body.join(" ");
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(joined))) {
    rows.push({ use: (m[1] ?? "").trim(), start: m[2] ?? "" });
  }
  return rows;
}

type DecommissionRow = { reason: string; start: string; end: string };

function decommissionReasonLv(raw: string): string {
  const t = raw.trim();
  if (/deregistrated due to a damage|due to a damage/i.test(t)) return "bojājuma dēļ";
  if (/export/i.test(t)) return "eksports";
  return t;
}

function parseDecommissioningHistory(lines: string[]): DecommissionRow[] {
  const body = sectionLines(lines, /^Decommissioning history\b/i, /^$/).filter(
    (l) => !/^(Reason for decommissioning|Time period)$/i.test(l),
  );
  const joined = body.join(" ");
  const rows: DecommissionRow[] = [];
  const rowRe = /([A-Za-z][A-Za-z\s/]{2,60}?)\s+(\d{1,2}\.\d{1,2}\.\d{4})\s*[\u2013-]\s*(\d{1,2}\.\d{1,2}\.\d{4})?/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(joined))) {
    rows.push({ reason: (m[1] ?? "").trim(), start: m[2] ?? "", end: m[3] ?? "" });
  }
  return rows;
}

type InsuranceRow = { company: string; start: string; end: string };

function parseInsuranceHistory(lines: string[]): InsuranceRow[] {
  const body = sectionLines(
    lines,
    /^Insurance history\b/i,
    /^(Finnish Transport and Communications Agency|Use history|This information is subject to a fee\.?)/i,
  ).filter((l) => !/^(Company|Start date|End date)$/i.test(l));
  const joined = body.join(" ");
  const rows: InsuranceRow[] = [];
  const rowRe =
    /([A-Za-z][A-Za-z .]{0,60}?)\s+(\d{1,2}\.\d{1,2}\.\d{4})\s*[\u2013-]?\s*(\d{1,2}\.\d{1,2}\.\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(joined))) {
    rows.push({
      company: (m[1] ?? "").trim(),
      start: m[2] ?? "",
      end: m[3] ?? "",
    });
  }
  return rows;
}

const RESTRICTION_LV: Array<{ re: RegExp; lv: string; redFlag: boolean }> = [
  {
    re: /periodic inspection not performed\/approved/i,
    lv: "Tehniskā apskate nav nokārtota / apstiprināta.",
    redFlag: true,
  },
  { re: /vehicle decommissioning/i, lv: "Auto noņemts no reģistra.", redFlag: true },
  { re: /prohibition of driving or use/i, lv: "Transportlīdzeklim noteikts braukšanas / lietošanas aizliegums.", redFlag: true },
];

export function parseTraficomReport(text: string): TraficomParsedReport | null {
  if (!looksLikeTraficomReport(text)) return null;
  const lines = linesOf(text);
  if (lines.length === 0) return null;

  const plate = findLabelValue(lines, /^Registration number\b/i);
  const vin = findLabelValue(lines, /^(Vehicle identification number \(VIN\)|VIN)(?:\s+|$)/i);
  const make = findLabelValue(lines, /^Make\b/i);
  const commercialName = findLabelValue(lines, /^Commercial name\b/i);
  const vehicleCategory = findLabelValue(lines, /^Vehicle category\b/i);
  const vehicleStatus = findLabelValue(lines, /^Vehicle status\b/i);
  const dateOfEntryIntoService = findLabelValue(lines, /^Date of entry into service\b/i);
  const firstRegistrationInFinland = findLabelValue(lines, /^First registration in Finland\b/i);
  const nextInspectionPeriod = findLabelValue(lines, /^Next inspection period\b/i);
  const drivingPower = findLabelValue(lines, /^Driving power\b/i);
  const transferDate = findLabelValue(lines, /^Date of transfer\b/i);
  const pendingData = findLabelValue(lines, /^Pending data\b/i);

  const taxStatusLines = sectionLines(lines, /^Tax status\b/i, /^(Restrictions|Pending data|Basic information)\b/i);
  const restrictionLines = sectionLines(lines, /^Restrictions\b/i, /^(Pending data|Basic information|Tax details)\b/i);

  const ownerHistory = parseOwnerHistory(lines);
  const currentOwner = parseCurrentOwner(lines);
  const useHistory = parseUseHistory(lines);
  const decommission = parseDecommissioningHistory(lines);
  const insuranceHistory = parseInsuranceHistory(lines);

  // Īpašnieku skaits: unikāli nosaukumi ar owner (ne operator) lomu + spēkā esošais īpašnieks.
  const ownerNames = new Set<string>();
  for (const row of ownerHistory) {
    if (isOwnerRole(row.typeRaw) && row.name) ownerNames.add(row.name.toLowerCase());
  }
  if (currentOwner?.name) ownerNames.add(currentOwner.name.toLowerCase());
  const ownerCount = ownerNames.size;

  const ownersSummaryLines: string[] = [];
  for (const row of ownerHistory) {
    if (!row.name) continue;
    const period = row.end ? `${dateFi(row.start)} - ${dateFi(row.end)}` : dateFi(row.start);
    ownersSummaryLines.push(`${period} ${ownershipTypeLv(row.typeRaw)}: ${row.name}`);
  }
  if (currentOwner?.name) {
    ownersSummaryLines.push(`${dateFi(currentOwner.start)} - Īpašnieks: ${currentOwner.name}`);
  }
  if (ownerCount > 0) ownersSummaryLines.push(`Īpašnieku skaits Somijā: ${ownerCount}.`);
  const ownersSummary = ownersSummaryLines
    .map((l) => sanitizeVinRegistryClientLine(l))
    .filter(Boolean)
    .join("\n");

  const statusLines: string[] = [];
  if (plate) statusLines.push(`Numurs: ${plate}`);
  if (vehicleStatus) {
    statusLines.push(
      /decommission/i.test(vehicleStatus)
        ? "Statuss: noņemts no reģistra (Decommissioned)."
        : `Statuss: ${vehicleStatus}`,
    );
  }
  if (nextInspectionPeriod) statusLines.push(`Nākamā tehniskā apskate: ${nextInspectionPeriod}`);
  if (drivingPower) statusLines.push(`Dzinēja veids: ${drivingPower}`);
  for (const raw of taxStatusLines) {
    if (/^no unpaid/i.test(raw)) {
      statusLines.push(`Nodokļu statuss: nav nesamaksāta nodokļa (${raw}).`);
    } else if (raw) {
      statusLines.push(`Nodokļu statuss: ${raw}`);
    }
  }
  if (insuranceHistory.length > 0) {
    statusLines.push(`Apdrošinātāju vēsture Somijā: ${insuranceHistory.length} ieraksti avotā.`);
  }
  const statusRecords = statusLines
    .map((l) => sanitizeVinRegistryClientLine(l))
    .filter(Boolean)
    .join("\n");

  const autoNotesSet = new Set<string>();
  if (/prohibition of driving or use/i.test(text)) {
    autoNotesSet.add("Transportlīdzeklim noteikts braukšanas / lietošanas aizliegums.");
  }
  for (const raw of restrictionLines) {
    const known = RESTRICTION_LV.find((r) => r.re.test(raw));
    autoNotesSet.add(known ? known.lv : raw);
  }
  const autoNotesLines: string[] = [...autoNotesSet].filter(Boolean);
  for (const row of decommission) {
    const reason = decommissionReasonLv(row.reason);
    const period = row.end ? `${dateFi(row.start)} - ${dateFi(row.end)}` : `${dateFi(row.start)} -`;
    autoNotesLines.push(`Noņemts no reģistra (${period}): ${reason}.`);
  }
  if (pendingData) autoNotesLines.push(`Neapstiprināti dati: ${pendingData}.`);
  const autoNotes = autoNotesLines
    .map((l) => sanitizeVinRegistryClientLine(l))
    .filter(Boolean)
    .join("\n");

  const timeline: VinRegistryTimelineRow[] = [];
  if (dateOfEntryIntoService) {
    timeline.push({ date: dateFi(dateOfEntryIntoService), odometer: "", country: FI, event: "Nodošana ekspluatācijā" });
  }
  if (firstRegistrationInFinland) {
    timeline.push({
      date: dateFi(firstRegistrationInFinland),
      odometer: "",
      country: FI,
      event: "Pirmā reģistrācija Somijā",
    });
  }
  if (transferDate) {
    timeline.push({ date: dateFi(transferDate), odometer: "", country: FI, event: "Paziņojums par īpašnieka maiņu" });
  }
  for (const row of ownerHistory) {
    if (!row.start) continue;
    timeline.push({
      date: dateFi(row.start),
      odometer: "",
      country: FI,
      event: `${ownershipTypeLv(row.typeRaw)}: ${row.name}`,
    });
  }
  if (currentOwner?.start) {
    timeline.push({
      date: dateFi(currentOwner.start),
      odometer: "",
      country: FI,
      event: `Īpašnieks: ${currentOwner.name}`,
    });
  }
  for (const row of useHistory) {
    if (!row.start) continue;
    timeline.push({ date: dateFi(row.start), odometer: "", country: FI, event: `Lietošanas veids: ${useLv(row.use)}` });
  }
  for (const row of decommission) {
    if (!row.start) continue;
    const reason = decommissionReasonLv(row.reason);
    timeline.push({
      date: dateFi(row.start),
      odometer: "",
      country: FI,
      event: `Noņemts no reģistra ${reason}`,
    });
  }
  for (const row of insuranceHistory) {
    if (!row.start) continue;
    const period = row.end ? `${dateFi(row.start)} - ${dateFi(row.end)}` : dateFi(row.start);
    timeline.push({
      date: dateFi(row.start),
      odometer: "",
      country: FI,
      event: `Apdrošināšana: ${row.company} (${period})`,
    });
  }

  const incidents: VinRegistryIncidentRow[] = [];
  for (const row of decommission) {
    const reason = decommissionReasonLv(row.reason);
    if (!row.start || !/bojāj/i.test(reason)) continue;
    incidents.push({
      date: dateFi(row.start),
      amount: "",
      country: FI,
      note: `Noņemts no reģistra ${reason}`,
    });
  }

  const context: string[] = ["Somijas oficiālais reģistrs (Traficom)"];
  if (make || commercialName) context.push(`Marka / modelis: ${[make, commercialName].filter(Boolean).join(" ")}`);
  if (vehicleCategory) context.push(`Kategorija: ${vehicleCategory}`);
  if (statusRecords) context.push(statusRecords);
  if (ownersSummary) context.push(`Īpašnieki:\n${ownersSummary}`);
  if (autoNotes) context.push(`Piezīmes:\n${autoNotes}`);

  return {
    plate,
    vin,
    ownersSummary,
    statusRecords,
    autoNotes,
    timeline,
    incidents,
    aiContextRaw: context.join("\n").slice(0, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN),
  };
}

export function traficomParseSummary(parsed: TraficomParsedReport): string {
  const plate = parsed.plate ? ` ${parsed.plate}` : "";
  return `Somijas reģistrs${plate}: ${parsed.timeline.length} laikposma notikumi.`;
}

/** Strukturētos laukus atjauno. AI kontekstu aizpilda tikai ja tas ir tukšs. */
export function applyTraficomReportToBlock(
  existing: VinRegistryBlockState | null | undefined,
  text: string,
): { block: VinRegistryBlockState; summary: string } | null {
  const parsed = parseTraficomReport(text);
  if (!parsed) return null;
  const base = existing ?? emptyVinRegistryBlock();
  const block: VinRegistryBlockState = {
    ...base,
    ...(parsed.timeline.length > 0 ? { timeline: sortVinRegistryTimeline(parsed.timeline) } : {}),
    ...(parsed.incidents.length > 0 ? { incidents: parsed.incidents } : {}),
    ...(parsed.ownersSummary ? { ownersSummary: parsed.ownersSummary } : {}),
    ...(parsed.statusRecords ? { statusRecords: parsed.statusRecords } : {}),
    ...(parsed.autoNotes ? { autoNotes: parsed.autoNotes } : {}),
    ...((base.aiContextRaw ?? "").trim() ? {} : { aiContextRaw: parsed.aiContextRaw }),
  };
  return { block, summary: traficomParseSummary(parsed) };
}
