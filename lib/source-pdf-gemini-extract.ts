import "server-only";

import {
  GEMINI_MODEL_PRO,
  geminiGenerateJsonText,
  type GeminiUserPart,
} from "@/lib/admin-gemini";
import type { CsddFormFields, SourcePdfChecklist } from "@/lib/admin-source-blocks";
import {
  autoRecordsMileageRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";
import type {
  CarVerticalDamageDetailRow,
  CarVerticalTimelineRow,
} from "@/lib/carvertical-pdf-parse";
import { buildCsddFieldsFromPdfSources } from "@/lib/csdd-pdf-ingest";
import type { SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";
import type { AutoRecordsPdfParseResult } from "@/lib/auto-records-pdf-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import {
  parseHistoryVendorPdfText,
  type HistoryVendorPdfParseResult,
  type HistoryVendorPdfTarget,
} from "@/lib/history-vendor-pdf-import";
import { PDF_GEMINI_INLINE_MAX_BYTES } from "@/lib/pdf-api-limits";
import {
  normalizeSourcePdfComment,
  SOURCE_PDF_COMMENT_GEMINI_RULES,
} from "@/lib/source-summary-comment-format";
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";

export type SourcePdfExtractTarget = SourcePdfIngestTarget;

export type CsddPdfParseResult = {
  rawUnprocessedData: string;
  fields: CsddFormFields;
  warnings: string[];
  meta: {
    charCount: number;
    engine: "gemini_fallback";
    extractionMethod: "gemini";
  };
};

export type PdfClassifyResult = {
  target: SourcePdfIngestTarget;
  label?: string;
};

const LOG_PREFIX = "[source-pdf-gemini]";
const MAX_RAW = 120_000;

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown, max = 120_000): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function normalizeServiceRow(raw: unknown): AutoRecordsServiceRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const date = formatAutoRecordsDateForOutput(asString(o.date, 32));
  const odometer = normalizeAutoRecordsOdometer(asString(o.odometer, 32));
  const country = normalizeCountryNameLv(asString(o.country, 80));
  const row: AutoRecordsServiceRow = { date, odometer, country };
  return autoRecordsMileageRowHasData(row) ? row : null;
}

function normalizeDamageDetailRow(raw: unknown): CarVerticalDamageDetailRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const row: CarVerticalDamageDetailRow = {
    date: formatAutoRecordsDateForOutput(asString(o.date, 32)),
    country: normalizeCountryNameLv(asString(o.country, 80)),
    lossAmount: asString(o.lossAmount ?? o.amount, 64),
    damagedSides: asString(o.damagedSides ?? o.sides, 120),
    damageGroups: asString(o.damageGroups ?? o.groups, 200),
  };
  if (!row.date.trim() && !row.lossAmount.trim() && !row.damagedSides.trim()) return null;
  return row;
}

function normalizeTimelineRow(raw: unknown): CarVerticalTimelineRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const row: CarVerticalTimelineRow = {
    date: formatAutoRecordsDateForOutput(asString(o.date, 32)),
    country: normalizeCountryNameLv(asString(o.country, 80)),
    description: asString(o.description, 240),
  };
  if (!row.date.trim() && !row.description.trim()) return null;
  return row;
}

function normalizeIncidentRow(raw: unknown): LtabIncidentRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const row: LtabIncidentRow = {
    csngDate: formatAutoRecordsDateForOutput(asString(o.csngDate ?? o.date, 32)),
    lossAmount: asString(o.lossAmount ?? o.amount, 64),
    incidentNo: normalizeCountryNameLv(asString(o.incidentNo ?? o.country, 80)),
  };
  return ltabRowHasData(row) ? row : null;
}

function normalizeChecklist(raw: unknown): Partial<SourcePdfChecklist> {
  const o = asRecord(raw);
  if (!o) return {};
  return {
    ...(o.incidents === true ? { incidents: true } : {}),
    ...(o.mileageHistory === true ? { mileageHistory: true } : {}),
    ...(o.mileageLine === true ? { mileageLine: true } : {}),
  };
}

function dedupeServiceRows(rows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  const seen = new Set<string>();
  const out: AutoRecordsServiceRow[] = [];
  for (const r of rows) {
    if (!autoRecordsMileageRowHasData(r)) continue;
    const key = `${r.date}|${r.odometer}|${r.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return sortAutoRecordsDescending(out);
}

function dedupeIncidents(rows: LtabIncidentRow[]): LtabIncidentRow[] {
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

const VENDOR_SYSTEM = `You are PROVIN.LV admin PDF data extractor. Read the attached vehicle history PDF (and optional text extract) for ONE vendor report.
Return ONLY valid JSON — no markdown.

Map every table and timeline you can find into structured fields. Dates as DD.MM.YYYY when possible. Odometer as digits only (no "km"). Country names in Latvian when known (e.g. Latvija, Vācija).

JSON schema:
{
  "mileagePasteRaw": "string — verbatim odometra / vehicle history section text for admin paste field",
  "rawTextSnippet": "string — short representative excerpt (max 8000 chars)",
  "serviceHistory": [{"date":"DD.MM.YYYY","odometer":"digits","country":"string"}],
  "incidents": [{"csngDate":"DD.MM.YYYY","lossAmount":"e.g. 2930.00 €","incidentNo":"country name or ISO"}],
  "damageDetails": [{"date":"DD.MM.YYYY","country":"string","lossAmount":"EUR range or amount","damagedSides":"string","damageGroups":"string"}],
  "vehicleHistoryTimeline": [{"date":"DD.MM.YYYY","country":"string","description":"string"}],
  "pdfChecklist": {"incidents": boolean, "mileageHistory": boolean, "mileageLine": boolean},
  "comments": "string — see COMMENTS rules below"
}

${SOURCE_PDF_COMMENT_GEMINI_RULES}

Rules:
- serviceHistory: ONLY rows with explicit odometer km digits (≥3 digits). If a timeline line has only year/date without km — do NOT add to serviceHistory.
- incidents: ALL damage/claim/accident rows with date + amount + country (including insurance tables).
- damageDetails: body damage sections (CarVertical „Virsbūves bojājums”, AutoDNA damage tables) — every event with date, country, loss/cost, affected sides/zones.
- vehicleHistoryTimeline: non-mileage history events (registration, sale, inspection) when shown separately from odometer log.
- pdfChecklist.incidents true if any accident/claim/damage mentioned; mileageHistory true if odometer history exists; mileageLine true if chart/curve looks consistent.
- comments: factual context (damage zone text, dealer milestones, registration) AND anomalies per COMMENTS rules — never output only "no issues" when descriptive history exists.
- Never invent VIN or plate; use only PDF content.`;

const TARGET_USER: Record<HistoryVendorPdfTarget, string> = {
  autodna: `TARGET: AutoDNA report (Latvian UI labels).
CRITICAL terminology:
- "TRANSPORTLĪDZEKĻA VĒSTURE" = odometer timeline → serviceHistory ONLY when km digits are shown next to the date.
- "Transportlīdzekļa zaudējumu apjoms" / "Zaudējumu apjoms" = damage/insurance loss events → map EVERY row to incidents[] (csngDate, lossAmount EUR, incidentNo=country). Also mirror into damageDetails when sides/zones are listed.
- Year-only lines in history without km are NOT mileage rows.
Extract: first registration, Status Center, average mileage text into comments.`,
  carvertical: `TARGET: CarVertical report.
Extract: Odometer / mileage log → serviceHistory (km required per row), insurance claims → incidents, "Virsbūves bojājums" / damage sections → damageDetails (date, country, lossAmount, damagedSides, damageGroups), timeline events → vehicleHistoryTimeline.
In comments: body damage zones, mileage milestones, market hints.`,
  ltab: `TARGET: LTAB / OCTA Latvia insurance report.
Extract ONLY insurance accidents: each row needs csngDate, lossAmount (EUR), incidentNo as country. Put policy period / negadījumu skaits / reģ. nr. in comments as facts. serviceHistory may be empty array.`,
};

const CITI_AVOTI_USER = `TARGET: Foreign or uncommon vehicle history PDF (not AutoDNA/CarVertical/LTAB/Auto Records/CSDD).
Read the document layout and map equivalent sections: odometer/mileage tables → serviceHistory (km required), accidents/claims/damage → incidents + damageDetails when body zones exist, other timeline → vehicleHistoryTimeline.
Set vendorLabel in JSON root if the report issuer name is visible (footer/header).`;

const CSDD_SYSTEM = `You are PROVIN.LV admin PDF extractor for CSDD Latvia vehicle registry printouts (e.csdd.lv / csdd.lv PDF).
Return ONLY valid JSON.

PRIORITY: "rawUnprocessedData" must contain the COMPLETE verbatim PDF text (all pages, all tables, all defect lines) up to 120000 characters. Copy every section header and row — this drives automated parsing. Do NOT summarize rawUnprocessedData.

Required sections in rawUnprocessedData when present in PDF:
- Iepriekšējās reģistrācijas valsts (e.g. VĀCIJA, Vācija)
- Transportlīdzekļa reģistrācija (īpašnieku skaits, datumi, Pirmā reģistrācija Latvijā, Īpašnieka maiņa)
- Tehniskie dati / Pārbaudes veids / Nākamās apskates datums / Odometra rādījums / Novērtējums / Dūmainības koeficients
- Detalizētais vērtējums (defect table: Kods, Novērtējums, Trūkumi vai bojājumi)
- Iepriekšējās apskates dati (FULL previous TA: dates, odometer, rating, smoke, Piezīmes, every defect row)
- Nobraukuma vēsture / Nobraukums ārvalstīs (date + km lines)
- Tehnisko apskašu vēsture (EVERY "Apskates datums" block with all defects)

Also fill structured JSON (backup if layout is clear):
{
  "rawUnprocessedData": "string",
  "makeModel": "string",
  "registrationNumber": "string",
  "firstRegistration": "YYYY-MM-DD",
  "nextInspectionDate": "YYYY-MM-DD",
  "prevInspectionDate": "YYYY-MM-DD",
  "engineDisplacementCm3": "string",
  "enginePowerKw": "string",
  "fuelType": "string",
  "emissionStandard": "string",
  "grossMassKg": "string",
  "curbMassKg": "string",
  "roadTaxEur": "string",
  "registrationStatus": "string",
  "opacityCoefficient": "string",
  "particulateMatter": "string",
  "previousRegistrationCountry": "string — Iepriekšējās reģistrācijas valsts",
  "ownerCountLatvia": "string — digit only",
  "ownerRegistrationEvents": [{"date":"DD.MM.YYYY","label":"string"}],
  "prevInspectionBlock": {
    "inspectionType": "string",
    "inspectionDateText": "DD.MM.YYYY",
    "nextInspectionDateText": "DD.MM.YYYY",
    "odometer": "digits",
    "ratingLabel": "string",
    "ratingLevel": 1|2|3,
    "smokeCoefficient": "string",
    "notes": "string",
    "defects": [{"code":"string","rating":"1|2|3","description":"string"}]
  },
  "technicalInspectionHistory": [{
    "date":"DD.MM.YYYY",
    "inspectionType":"string",
    "ratingLabel":"string",
    "ratingLevel":1|2|3,
    "smokeCoefficient":"string",
    "notes":"string",
    "defects":[{"code":"string","rating":"string","description":"string"}]
  }],
  "mileageHistory": [{"date":"DD.MM.YYYY","odometer":"digits","country":"string"}],
  "warnings": ["string"]
}
Rules:
- prevInspectionBlock = section "Iepriekšējās apskates dati" when present (not current "Tehniskie dati" head).
- technicalInspectionHistory: all historic TA blocks from "Tehnisko apskašu vēsture".
- mileageHistory: only lines with km digits (≥3).`;

const CLASSIFY_SYSTEM = `You classify a vehicle history PDF for PROVIN.LV admin routing.
Return ONLY JSON: {"target":"autodna"|"carvertical"|"ltab"|"auto_records"|"csdd"|"citi_avoti","vendorLabel":"optional string"}
- autodna: AutoDNA branding or TRANSPORTLĪDZEKĻA VĒSTURE / Transportlīdzekļa zaudējumu apjoms
- carvertical: CarVertical branding, VIN report layout
- ltab: LTAB / OCTA Latvia insurance
- auto_records: auto-records.com ODOMETER CHECK
- csdd: CSDD / e.csdd.lv registry printout
- citi_avoti: any other issuer (HPI, national registry abroad, etc.) — set vendorLabel to issuer name if visible`;

const AUTO_RECORDS_SYSTEM = `You are PROVIN.LV admin PDF extractor for auto-records.com dealer reports.
Return ONLY valid JSON:
{
  "rawUnprocessedData": "string — key sections: ODOMETER CHECK, service events (max 120000 chars)",
  "serviceHistory": [{"date":"DD.MM.YYYY","odometer":"digits","country":"string"}],
  "pdfChecklist": {"incidents": boolean, "mileageHistory": boolean, "mileageLine": boolean},
  "vehicleInfo": {
    "vinCode": "string",
    "model": "string",
    "series": "string",
    "generation": "string",
    "typeCode": "string",
    "engineCode": "string",
    "steeringSide": "string",
    "color": "string",
    "interior": "string",
    "transmission": "string"
  },
  "comments": "string — see COMMENTS rules",
  "warnings": ["string"]
}
${SOURCE_PDF_COMMENT_GEMINI_RULES}
Extract every service/odometer row from tables (dates YYYY-MM-DD or DD.MM.YYYY; odometer even if glued to "km" or "ServiceVisit"). checklist.incidents if damage/accident mentioned.
In comments: factual service timeline (e.g. dealer visit at km) and damage notes from text; use ANOMĀLIJA: only for clear conflicts.

Also extract VEHICLE INFORMATION fields into vehicleInfo (VIN Code, Model, Series, Generation, Type code, Engine code, Steering side, Color, Interior, Transmission). If value is missing or shown as "-" then use empty string for that field.`;

function parseDamageAndTimeline(payload: Record<string, unknown>) {
  const damageDetails = (Array.isArray(payload.damageDetails) ? payload.damageDetails : [])
    .map(normalizeDamageDetailRow)
    .filter((r): r is CarVerticalDamageDetailRow => r !== null);
  const vehicleHistoryTimeline = (
    Array.isArray(payload.vehicleHistoryTimeline) ? payload.vehicleHistoryTimeline : []
  )
    .map(normalizeTimelineRow)
    .filter((r): r is CarVerticalTimelineRow => r !== null);
  return { damageDetails, vehicleHistoryTimeline };
}

function vendorResultFromGemini(
  target: HistoryVendorPdfTarget,
  payload: Record<string, unknown>,
  fileName: string,
): HistoryVendorPdfParseResult {
  const serviceHistory = dedupeServiceRows(
    (Array.isArray(payload.serviceHistory) ? payload.serviceHistory : [])
      .map(normalizeServiceRow)
      .filter((r): r is AutoRecordsServiceRow => r !== null),
  );
  const incidents = dedupeIncidents(
    (Array.isArray(payload.incidents) ? payload.incidents : [])
      .map(normalizeIncidentRow)
      .filter((r): r is LtabIncidentRow => r !== null),
  );
  const { damageDetails, vehicleHistoryTimeline } = parseDamageAndTimeline(payload);
  const mileagePasteRaw = asString(payload.mileagePasteRaw, 24_000);
  const rawText = asString(payload.rawTextSnippet ?? payload.rawText, MAX_RAW);
  const comments = normalizeSourcePdfComment(asString(payload.comments, 800));
  const suggestedPdfChecklist = normalizeChecklist(payload.pdfChecklist);

  const base = parseHistoryVendorPdfText(target, rawText || mileagePasteRaw);
  const warnings = [...base.warnings];
  if (
    serviceHistory.length === 0 &&
    incidents.length === 0 &&
    damageDetails.length === 0
  ) {
    warnings.push("Gemini neatrada strukturētas rindas — pārbaudi PDF manuāli.");
  } else {
    warnings.push(`Datu avots: Gemini PDF (${fileName}).`);
  }

  return {
    rawText: rawText || mileagePasteRaw || base.rawText,
    serviceHistory: serviceHistory.length > 0 ? serviceHistory : base.serviceHistory,
    incidents: incidents.length > 0 ? incidents : base.incidents,
    ...(damageDetails.length > 0 || (base.damageDetails ?? []).length > 0
      ? { damageDetails: damageDetails.length > 0 ? damageDetails : base.damageDetails }
      : {}),
    ...(vehicleHistoryTimeline.length > 0 || (base.vehicleHistoryTimeline ?? []).length > 0
      ? {
          vehicleHistoryTimeline:
            vehicleHistoryTimeline.length > 0 ? vehicleHistoryTimeline : base.vehicleHistoryTimeline,
        }
      : {}),
    suggestedPdfChecklist: { ...base.suggestedPdfChecklist, ...suggestedPdfChecklist },
    suggestedComments: comments,
    warnings,
    meta: {
      charCount: (rawText || mileagePasteRaw).length,
      mileageRowCount: serviceHistory.length || base.meta.mileageRowCount,
      incidentRowCount: incidents.length || base.meta.incidentRowCount,
      engine: "gemini_fallback",
      extractionMethod: "gemini",
    },
  };
}

function csddResultFromGemini(
  payload: Record<string, unknown>,
  fileName: string,
  textHint?: string,
): CsddPdfParseResult {
  const geminiRaw = asString(payload.rawUnprocessedData ?? payload.rawTextSnippet, MAX_RAW);
  const { fields, rawUnprocessedData } = buildCsddFieldsFromPdfSources({
    textHint,
    geminiRaw,
    geminiPayload: payload,
  });

  const mileageFromGemini = dedupeServiceRows(
    (Array.isArray(payload.mileageHistory) ? payload.mileageHistory : [])
      .map(normalizeServiceRow)
      .filter((r): r is AutoRecordsServiceRow => r !== null),
  );
  let mergedFields = fields;
  if (mileageFromGemini.length > 0 && !fields.mileageHistory.some((r) => r.odometer.trim())) {
    mergedFields = {
      ...fields,
      mileageHistory: mileageFromGemini.map((r) => ({
        date: r.date,
        odometer: r.odometer,
        country: r.country || "Latvija",
      })),
    };
  }

  const warnings = (Array.isArray(payload.warnings) ? payload.warnings : [])
    .filter((w): w is string => typeof w === "string")
    .slice(0, 6);
  warnings.unshift(`Datu avots: Gemini PDF CSDD (${fileName}).`);
  if (textHint?.trim() && rawUnprocessedData.length > geminiRaw.length * 1.1) {
    warnings.push("Papildināts ar PDF teksta slāni — pilnāks parsējums.");
  }

  return {
    rawUnprocessedData,
    fields: mergedFields,
    warnings,
    meta: { charCount: rawUnprocessedData.length, engine: "gemini_fallback", extractionMethod: "gemini" },
  };
}

function autoRecordsResultFromGemini(
  payload: Record<string, unknown>,
  fileName: string,
): AutoRecordsPdfParseResult {
  const serviceHistory = dedupeServiceRows(
    (Array.isArray(payload.serviceHistory) ? payload.serviceHistory : [])
      .map(normalizeServiceRow)
      .filter((r): r is AutoRecordsServiceRow => r !== null),
  );
  const rawUnprocessedData = asString(payload.rawUnprocessedData, MAX_RAW);
  const suggestedPdfChecklist = normalizeChecklist(payload.pdfChecklist);
  const suggestedComments = normalizeSourcePdfComment(asString(payload.comments, 800));
  const vehiclePayload = asRecord(payload.vehicleInfo);
  const normalizeVehicleField = (v: unknown) => {
    if (typeof v !== "string") return "";
    const t = v.trim();
    if (!t) return "";
    if (/^(\-+|—|–)$/i.test(t)) return "";
    return t;
  };
  const suggestedOutvinVehicleInfo: Partial<OutvinVehicleInfo> | undefined = (() => {
    if (!vehiclePayload) return undefined;
    const keys: (keyof OutvinVehicleInfo)[] = [
      "vinCode",
      "model",
      "series",
      "generation",
      "typeCode",
      "engineCode",
      "steeringSide",
      "color",
      "interior",
      "transmission",
    ];
    const out: Partial<OutvinVehicleInfo> = {};
    for (const k of keys) {
      const v = normalizeVehicleField(vehiclePayload[k]);
      if (v) out[k] = v;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  })();
  const warnings = (Array.isArray(payload.warnings) ? payload.warnings : [])
    .filter((w): w is string => typeof w === "string")
    .slice(0, 8);
  if (serviceHistory.length > 0) {
    warnings.unshift(`Datu avots: Gemini PDF (${fileName}).`);
  } else {
    warnings.push("Gemini neatrada nobraukuma rindas — pārbaudi PDF.");
  }

  return {
    serviceHistory,
    rawUnprocessedData,
    suggestedPdfChecklist,
    suggestedComments,
    suggestedOutvinVehicleInfo,
    warnings,
    meta: {
      charCount: rawUnprocessedData.length,
      rowCount: serviceHistory.length,
      usedOdometerSection: serviceHistory.length > 0,
      engine: "gemini_fallback",
      extractionMethod: "gemini",
    },
  };
}

export function csddParseHasData(r: CsddPdfParseResult): boolean {
  if (r.rawUnprocessedData.length > 120) return true;
  const f = r.fields;
  return Boolean(
    f.makeModel.trim() ||
      f.registrationNumber.trim() ||
      f.mileageHistory.some((row) => row.date.trim() || row.odometer.trim()),
  );
}

export function vendorParseHasData(r: HistoryVendorPdfParseResult): boolean {
  if (r.serviceHistory.some(autoRecordsMileageRowHasData)) return true;
  if (r.incidents.some(ltabRowHasData)) return true;
  if ((r.vehicleHistoryTimeline ?? []).some((row) => row.date.trim() || row.description.trim())) return true;
  if ((r.damageDetails ?? []).some((row) => row.date.trim() || row.lossAmount.trim())) return true;
  return r.rawText.length > 80;
}

export function autoRecordsParseHasData(r: AutoRecordsPdfParseResult): boolean {
  return r.serviceHistory.some(autoRecordsMileageRowHasData) || r.rawUnprocessedData.length > 80;
}

const VALID_CLASSIFY_TARGETS = new Set<SourcePdfIngestTarget>([
  "autodna",
  "carvertical",
  "ltab",
  "auto_records",
  "csdd",
  "citi_avoti",
]);

/** Gemini klasificē avotu pēc PDF satura (kad nosaukums nav pietiekams). */
export async function classifyPdfIngestTargetWithGemini(opts: {
  buffer: ArrayBuffer;
  fileName: string;
  textHint?: string;
}): Promise<PdfClassifyResult> {
  const { buffer, fileName, textHint } = opts;
  if (buffer.byteLength > PDF_GEMINI_INLINE_MAX_BYTES) {
    return { target: "citi_avoti", label: fileName.replace(/\.pdf$/i, "") };
  }
  const extraParts: GeminiUserPart[] = [
    {
      inlineData: { mimeType: "application/pdf", data: bufferToBase64(buffer) },
    },
    { text: `[PDF document: ${fileName}]` },
  ];
  const textSection =
    textHint && textHint.trim().length > 0
      ? `\n\nText extract:\n${textHint.trim().slice(0, 40_000)}`
      : "";
  try {
    const raw = await geminiGenerateJsonText({
      model: GEMINI_MODEL_PRO,
      systemInstruction: CLASSIFY_SYSTEM,
      extraParts,
      userPrompt: `Classify this PDF.${textSection}`,
      temperature: 0,
    });
    const payload = asRecord(JSON.parse(raw));
    const targetRaw = asString(payload?.target, 32).toLowerCase();
    const target = VALID_CLASSIFY_TARGETS.has(targetRaw as SourcePdfIngestTarget)
      ? (targetRaw as SourcePdfIngestTarget)
      : "citi_avoti";
    const label = asString(payload?.vendorLabel, 80);
    console.info(`${LOG_PREFIX} classify_ok`, { fileName, target, label });
    return { target, ...(label ? { label } : {}) };
  } catch (e) {
    console.warn(`${LOG_PREFIX} classify_failed`, {
      fileName,
      msg: e instanceof Error ? e.message : String(e),
    });
    return { target: "citi_avoti", label: fileName.replace(/\.pdf$/i, "") };
  }
}

export async function extractSourcePdfWithGemini(opts: {
  target: SourcePdfExtractTarget;
  buffer: ArrayBuffer;
  fileName: string;
  textHint?: string;
}): Promise<HistoryVendorPdfParseResult | AutoRecordsPdfParseResult | CsddPdfParseResult> {
  const { target, buffer, fileName, textHint } = opts;
  if (buffer.byteLength > PDF_GEMINI_INLINE_MAX_BYTES) {
    throw new Error("pdf_too_large_for_gemini");
  }

  const extraParts: GeminiUserPart[] = [
    {
      inlineData: {
        mimeType: "application/pdf",
        data: bufferToBase64(buffer),
      },
    },
    { text: `[PDF document: ${fileName}]` },
  ];

  const textSection =
    textHint && textHint.trim().length > 0
      ? `\n\nPartial text layer extract (may be incomplete):\n${textHint.trim().slice(0, 60_000)}`
      : "\n\nNo usable text layer — read the PDF binary attachment.";

  if (target === "csdd") {
    const raw = await geminiGenerateJsonText({
      model: GEMINI_MODEL_PRO,
      systemInstruction: CSDD_SYSTEM,
      extraParts,
      userPrompt: `Extract CSDD registry fields from this PDF.${textSection}`,
      temperature: 0.1,
    });
    let payload: Record<string, unknown> | null;
    try {
      payload = asRecord(JSON.parse(raw));
    } catch {
      throw new Error("gemini_invalid_json");
    }
    if (!payload) throw new Error("gemini_invalid_json");
    console.info(`${LOG_PREFIX} csdd_ok`, { fileName });
    return csddResultFromGemini(payload, fileName, textHint);
  }

  if (target === "auto_records") {
    const raw = await geminiGenerateJsonText({
      model: GEMINI_MODEL_PRO,
      systemInstruction: AUTO_RECORDS_SYSTEM,
      extraParts,
      userPrompt: `Extract AUTO RECORDS fields from this PDF.${textSection}`,
      temperature: 0.1,
    });
    let payload: Record<string, unknown> | null;
    try {
      payload = asRecord(JSON.parse(raw));
    } catch {
      throw new Error("gemini_invalid_json");
    }
    if (!payload) throw new Error("gemini_invalid_json");
    console.info(`${LOG_PREFIX} auto_records_ok`, { fileName, rows: payload.serviceHistory });
    return autoRecordsResultFromGemini(payload, fileName);
  }

  const vendorTarget: HistoryVendorPdfTarget =
    target === "citi_avoti" ? "autodna" : (target as HistoryVendorPdfTarget);
  const userIntro =
    target === "citi_avoti"
      ? `${CITI_AVOTI_USER}\nFile name hint: ${fileName}`
      : TARGET_USER[vendorTarget];
  const raw = await geminiGenerateJsonText({
    model: GEMINI_MODEL_PRO,
    systemInstruction: VENDOR_SYSTEM,
    extraParts,
    userPrompt: `${userIntro}\n\nExtract all fields.${textSection}`,
    temperature: 0.1,
  });
  let payload: Record<string, unknown> | null;
  try {
    payload = asRecord(JSON.parse(raw));
  } catch {
    throw new Error("gemini_invalid_json");
  }
  if (!payload) throw new Error("gemini_invalid_json");
  console.info(`${LOG_PREFIX} vendor_ok`, {
    fileName,
    target,
    mileage: Array.isArray(payload.serviceHistory) ? payload.serviceHistory.length : 0,
    incidents: Array.isArray(payload.incidents) ? payload.incidents.length : 0,
    damage: Array.isArray(payload.damageDetails) ? payload.damageDetails.length : 0,
  });
  return vendorResultFromGemini(vendorTarget, payload, fileName);
}
